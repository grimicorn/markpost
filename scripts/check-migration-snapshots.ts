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
// where import.meta.url is not a plain file:// URL.)
const MIGRATIONS_FOLDER = "server/db/migrations";
const META_FOLDER = `${MIGRATIONS_FOLDER}/meta`;
const JOURNAL_FILE = `${META_FOLDER}/_journal.json`;

const SNAPSHOT_FILENAME_PATTERN = /^(\d{4})_snapshot\.json$/;
const JOURNAL_TAG_PREFIX_PATTERN = /^(\d{4})_/;

type JournalEntry = {
  tag: string;
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
// whose `prevId` doesn't match the id of the snapshot immediately before it.
export function findBrokenChainLinks(
  orderedSnapshots: SnapshotChainLink[],
): string[] {
  return orderedSnapshots.flatMap((snapshot, index) => {
    if (index === 0) {
      return [];
    }

    const previousSnapshot = orderedSnapshots[index - 1];
    if (snapshot.prevId === previousSnapshot.id) {
      return [];
    }

    return [
      `${snapshot.tag}: prevId "${snapshot.prevId}" does not match ` +
        `"${previousSnapshot.tag}"'s id "${previousSnapshot.id}"`,
    ];
  });
}

function readJournal(): Journal {
  const raw = readFileSync(JOURNAL_FILE, "utf8");
  const journal = JSON.parse(raw) as Partial<Journal>;

  if (!Array.isArray(journal.entries)) {
    throw new Error(`${JOURNAL_FILE} has no "entries" array`);
  }

  return journal as Journal;
}

function snapshotFilenameForTag(tag: string): string {
  const prefix = tag.match(JOURNAL_TAG_PREFIX_PATTERN)?.[1];
  return `${prefix}_snapshot.json`;
}

function loadSnapshotChain(journalTags: string[]): SnapshotChainLink[] {
  return journalTags.map((tag) => {
    const filePath = `${META_FOLDER}/${snapshotFilenameForTag(tag)}`;
    const snapshot = JSON.parse(readFileSync(filePath, "utf8")) as {
      id: string;
      prevId: string;
    };

    return { tag, id: snapshot.id, prevId: snapshot.prevId };
  });
}

function reportProblems(title: string, problems: string[]): void {
  console.error(`${title}\n`);
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const journal = readJournal();
  const journalTags = journal.entries.map((entry) => entry.tag);
  const existingSnapshotFilenames = readdirSync(META_FOLDER);

  const missingTags = findMissingSnapshotTags(
    journalTags,
    existingSnapshotFilenames,
  );

  if (missingTags.length > 0) {
    reportProblems(
      "Missing migration snapshot file(s):",
      missingTags.map(
        (tag) => `${tag} (expected ${snapshotFilenameForTag(tag)})`,
      ),
    );
    console.error(
      `\nEach entry in ${JOURNAL_FILE} must have a matching <NNNN>_snapshot.json ` +
        `in ${META_FOLDER}/, or the next \`drizzle-kit generate\` will diff ` +
        "against a stale base schema.",
    );
    return;
  }

  const brokenLinks = findBrokenChainLinks(loadSnapshotChain(journalTags));

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

if (isInvokedDirectly()) {
  await main();
}
