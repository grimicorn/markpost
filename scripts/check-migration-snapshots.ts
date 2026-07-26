// Guard against the meta/ snapshot gap that let 0005-0008 disappear
// undetected: `_journal.json` lists every applied migration tag, but nothing
// previously checked that each tag has a matching `<NNNN>_snapshot.json` file
// in server/db/migrations/meta, or that each snapshot's `prevId` actually
// chains back to the snapshot before it. Either gap makes the next
// `drizzle-kit generate` silently diff schema.ts against a stale, older base
// state instead of the true cumulative schema — producing a bogus or
// incomplete migration.
import { readdirSync, readFileSync, realpathSync } from "node:fs";
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

function extractSnapshotPrefixes(snapshotFilenames: string[]): Set<string> {
  return new Set(
    snapshotFilenames
      .map((filename) => filename.match(SNAPSHOT_FILENAME_PATTERN)?.[1])
      .filter((prefix): prefix is string => Boolean(prefix)),
  );
}

export function findMissingSnapshotTags(
  journalTags: string[],
  existingSnapshotFilenames: string[],
): string[] {
  const existingPrefixes = extractSnapshotPrefixes(existingSnapshotFilenames);

  return journalTags.filter((tag) => {
    const prefix = tag.match(JOURNAL_TAG_PREFIX_PATTERN)?.[1];
    return !prefix || !existingPrefixes.has(prefix);
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
    const expectedPrevId =
      index === 0 ? ROOT_SNAPSHOT_PREV_ID : orderedSnapshots[index - 1].id;

    if (snapshot.prevId === expectedPrevId) {
      return [];
    }

    if (index === 0) {
      return [
        `${snapshot.tag}: prevId "${snapshot.prevId}" is not the root sentinel "${ROOT_SNAPSHOT_PREV_ID}"`,
      ];
    }

    const previousSnapshot = orderedSnapshots[index - 1];
    return [
      `${snapshot.tag}: prevId "${snapshot.prevId}" does not match ` +
        `"${previousSnapshot.tag}"'s id "${previousSnapshot.id}"`,
    ];
  });
}

function readJournal(journalFile: string): Journal {
  const raw = readFileSync(journalFile, "utf8");
  const journal = JSON.parse(raw) as Partial<Journal>;

  if (!Array.isArray(journal.entries)) {
    throw new Error(`${journalFile} has no "entries" array`);
  }

  const hasNonStringTag = journal.entries.some(
    (entry) => typeof entry?.tag !== "string",
  );
  if (hasNonStringTag) {
    throw new Error(`${journalFile} has an entry with a non-string "tag"`);
  }

  return journal as Journal;
}

function snapshotFilenameForTag(tag: string): string | undefined {
  const prefix = tag.match(JOURNAL_TAG_PREFIX_PATTERN)?.[1];
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
    const filePath = `${metaFolder}/${snapshotFilenameForTag(tag)}`;
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

function orderedJournalTags(journal: Journal): string[] {
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
  const metaFolder = `${migrationsFolder}/meta`;
  const journalFile = `${metaFolder}/_journal.json`;

  const journal = readJournal(journalFile);
  const journalTags = orderedJournalTags(journal);
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

  return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
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
