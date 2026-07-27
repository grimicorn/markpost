// Guard against the meta/ snapshot gap that let 0005-0008 disappear
// undetected: `_journal.json` lists every applied migration tag, but nothing
// previously checked that each tag has a matching `<NNNN>_snapshot.json` file
// in server/db/migrations/meta, or that each snapshot's `prevId` actually
// chains back to the snapshot before it. Either gap makes the next
// `drizzle-kit generate` silently diff schema.ts against a stale, older base
// state instead of the true cumulative schema — producing a bogus or
// incomplete migration.
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Relative to the repo root, matching scripts/check-migration-drift.ts's own
// convention: both scripts are only ever invoked via an npm script running
// from the package root. (An import.meta.url-anchored path was tried instead
// but breaks when this module is imported under vitest's SSR transform,
// where import.meta.url is not a plain file:// URL.) Overridable via a CLI
// arg so tests can point it at a fixture directory.
const DEFAULT_MIGRATIONS_FOLDER = "server/db/migrations";

// drizzle-kit seeds the very first snapshot's prevId with this all-zero UUID;
// there is no earlier snapshot for it to chain to.
const ROOT_SNAPSHOT_PREV_ID = "00000000-0000-0000-0000-000000000000";

const SNAPSHOT_FILENAME_PATTERN = /^(\d{4})_snapshot\.json$/;
const JOURNAL_TAG_PREFIX_PATTERN = /^(\d{4})_/;

type JournalEntry = {
  tag: string;
  idx: number;
};

type Journal = {
  entries: JournalEntry[];
};

export type SnapshotChainLink = {
  tag: string;
  id: string;
  prevId: string;
};

// Shared by findMissingSnapshotTags, findOrphanSnapshotFiles, and
// loadSnapshotChain (rule of three): every one of them needs the "NNNN"
// prefix out of a journal tag like "0005_add_events_table".
function journalTagPrefix(tag: string): string | undefined {
  return tag.match(JOURNAL_TAG_PREFIX_PATTERN)?.[1];
}

function snapshotFilePrefix(filename: string): string | undefined {
  return filename.match(SNAPSHOT_FILENAME_PATTERN)?.[1];
}

function extractSnapshotPrefixes(snapshotFilenames: string[]): Set<string> {
  return new Set(
    snapshotFilenames
      .map(snapshotFilePrefix)
      .filter((prefix): prefix is string => Boolean(prefix)),
  );
}

export function findMissingSnapshotTags(
  journalTags: string[],
  existingSnapshotFilenames: string[],
): string[] {
  const existingPrefixes = extractSnapshotPrefixes(existingSnapshotFilenames);

  return journalTags.filter((tag) => {
    const prefix = journalTagPrefix(tag);
    return !prefix || !existingPrefixes.has(prefix);
  });
}

// The inverse gap: a snapshot file left on disk with no matching journal
// entry (e.g. a bad merge dropped the journal entry but kept the file).
// `drizzle-kit generate` picks the highest-numbered snapshot file as its
// diff base regardless of the journal, so an orphan is just as dangerous as
// a missing snapshot.
export function findOrphanSnapshotFiles(
  journalTags: string[],
  existingSnapshotFilenames: string[],
): string[] {
  const journalPrefixes = new Set(
    journalTags
      .map(journalTagPrefix)
      .filter((prefix): prefix is string => Boolean(prefix)),
  );

  return existingSnapshotFilenames.filter((filename) => {
    const prefix = snapshotFilePrefix(filename);
    return Boolean(prefix) && !journalPrefixes.has(prefix as string);
  });
}

// A snapshot file existing is not enough: 0009_snapshot.json existed all
// along but its `prevId` pointed straight at 0004, silently skipping
// 0005-0008. This walks the chain in journal order and reports any link
// whose `prevId` doesn't match the id of the snapshot immediately before it
// (or, for the first snapshot, doesn't match drizzle's root sentinel).
export function findBrokenChainLinks(
  orderedSnapshots: SnapshotChainLink[],
): string[] {
  return orderedSnapshots.flatMap((snapshot, index) => {
    // orderedSnapshots[-1] is already undefined for index 0; no ternary needed.
    const previousSnapshot = orderedSnapshots[index - 1];
    const expectedPrevId = previousSnapshot?.id ?? ROOT_SNAPSHOT_PREV_ID;

    if (snapshot.prevId === expectedPrevId) {
      return [];
    }

    if (!previousSnapshot) {
      return [
        `${snapshot.tag}: prevId "${snapshot.prevId}" is not the root sentinel "${ROOT_SNAPSHOT_PREV_ID}"`,
      ];
    }

    return [
      `${snapshot.tag}: prevId "${snapshot.prevId}" does not match ` +
        `"${previousSnapshot.tag}"'s id "${previousSnapshot.id}"`,
    ];
  });
}

// drizzle keeps `idx` and the tag's NNNN_ prefix in lockstep (idx 5 <->
// "0005_..."); the chain is walked in `idx` order, so if the two ever
// disagree (a bad merge reordering entries without renumbering idx) the
// chain check would silently validate against the wrong migration.
function entryIdxMatchesTagPrefix(entry: JournalEntry): boolean {
  const prefix = journalTagPrefix(entry.tag);
  return prefix !== undefined && Number(prefix) === entry.idx;
}

function readJournal(journalFile: string): Journal {
  const raw = readFileSync(journalFile, "utf8");
  const journal = JSON.parse(raw) as Partial<Journal>;

  if (!Array.isArray(journal.entries)) {
    throw new Error(`${journalFile} has no "entries" array`);
  }

  const hasInvalidEntry = journal.entries.some(
    (entry) =>
      typeof entry?.tag !== "string" ||
      !Number.isInteger(entry?.idx) ||
      !entryIdxMatchesTagPrefix(entry),
  );
  if (hasInvalidEntry) {
    throw new Error(
      `${journalFile} has an entry with a non-string "tag", a non-integer "idx", or an "idx" that doesn't match its tag's NNNN_ prefix`,
    );
  }

  const idxValues = journal.entries.map((entry) => entry.idx);
  if (new Set(idxValues).size !== idxValues.length) {
    throw new Error(`${journalFile} has duplicate "idx" values`);
  }

  return journal as Journal;
}

function snapshotFilenameForTag(tag: string): string | undefined {
  const prefix = journalTagPrefix(tag);
  return prefix ? `${prefix}_snapshot.json` : undefined;
}

function describeExpectedSnapshot(tag: string): string {
  const filename = snapshotFilenameForTag(tag);
  return filename ? `expected ${filename}` : "tag has no NNNN_ prefix";
}

export function loadSnapshotChain(
  journalTags: string[],
  metaFolder: string,
): SnapshotChainLink[] {
  return journalTags.map((tag) => {
    const filename = snapshotFilenameForTag(tag);
    if (!filename) {
      throw new Error(`journal tag "${tag}" has no NNNN_ prefix`);
    }

    const filePath = join(metaFolder, filename);
    const raw = readFileSync(filePath, "utf8");
    const snapshot = JSON.parse(raw) as Partial<SnapshotChainLink>;

    if (
      typeof snapshot.id !== "string" ||
      typeof snapshot.prevId !== "string"
    ) {
      throw new Error(`${filePath} is missing a string "id" or "prevId"`);
    }

    return { tag, id: snapshot.id, prevId: snapshot.prevId };
  });
}

export function orderedJournalTags(journal: Journal): string[] {
  return [...journal.entries]
    .sort((first, second) => first.idx - second.idx)
    .map((entry) => entry.tag);
}

function reportProblems(title: string, problems: string[]): void {
  console.error(`${title}\n`);
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const migrationsFolder = process.argv[2] ?? DEFAULT_MIGRATIONS_FOLDER;
  const metaFolder = join(migrationsFolder, "meta");
  const journalFile = join(metaFolder, "_journal.json");

  const journal = readJournal(journalFile);
  const journalTags = orderedJournalTags(journal);

  if (journalTags.length === 0) {
    throw new Error(`${journalFile} has no entries`);
  }

  const existingSnapshotFilenames = readdirSync(metaFolder);

  const missingTags = findMissingSnapshotTags(
    journalTags,
    existingSnapshotFilenames,
  );

  if (missingTags.length > 0) {
    reportProblems(
      "Missing migration snapshot file(s):",
      missingTags.map((tag) => `${tag} (${describeExpectedSnapshot(tag)})`),
    );
    console.error(
      `\nEach entry in ${journalFile} must have a matching <NNNN>_snapshot.json ` +
        `in ${metaFolder}/, or the next \`drizzle-kit generate\` will diff ` +
        "against a stale base schema.",
    );
    return;
  }

  const orphanFilenames = findOrphanSnapshotFiles(
    journalTags,
    existingSnapshotFilenames,
  );

  if (orphanFilenames.length > 0) {
    reportProblems(
      "Snapshot file(s) with no matching journal entry:",
      orphanFilenames,
    );
    console.error(
      `\nEach <NNNN>_snapshot.json in ${metaFolder}/ must have a matching ` +
        `entry in ${journalFile}, or \`drizzle-kit generate\` will diff ` +
        "against an orphaned, unreferenced snapshot.",
    );
    return;
  }

  const brokenLinks = findBrokenChainLinks(
    loadSnapshotChain(journalTags, metaFolder),
  );

  if (brokenLinks.length > 0) {
    reportProblems("Broken migration snapshot chain link(s):", brokenLinks);
    console.error(
      "\nEach snapshot's prevId must match the id of the snapshot before it " +
        "in journal order, or `drizzle-kit generate` will diff against the " +
        "wrong base schema.",
    );
    return;
  }

  console.log(
    `All ${journalTags.length} journal entries have a matching, correctly-chained snapshot file.`,
  );
}

function isInvokedDirectly(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return (
      import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
    );
  } catch {
    return false;
  }
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (isInvokedDirectly()) {
  await run();
}
