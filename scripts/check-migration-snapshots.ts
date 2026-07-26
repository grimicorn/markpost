// Guard against the meta/ snapshot gap that let 0005-0008 disappear
// undetected: `_journal.json` lists every applied migration tag, but nothing
// previously checked that each tag has a matching `<NNNN>_snapshot.json` file
// in server/db/migrations/meta. Without a snapshot, the next `drizzle-kit
// generate` silently diffs schema.ts against a stale, older base state
// instead of the true cumulative schema — producing a bogus or incomplete
// migration.
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

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

async function main(): Promise<void> {
  const journal = JSON.parse(readFileSync(JOURNAL_FILE, "utf8")) as Journal;
  const existingSnapshotFilenames = readdirSync(META_FOLDER);
  const journalTags = journal.entries.map((entry) => entry.tag);

  const missingTags = findMissingSnapshotTags(
    journalTags,
    existingSnapshotFilenames,
  );

  if (missingTags.length === 0) {
    console.log(
      `All ${journalTags.length} journal entries have a matching snapshot file.`,
    );
    return;
  }

  console.error("Missing migration snapshot file(s):\n");
  for (const tag of missingTags) {
    console.error(`  ${tag}`);
  }
  console.error(
    `\nEach entry in ${JOURNAL_FILE} must have a matching <NNNN>_snapshot.json in ${META_FOLDER}/, or the next \`drizzle-kit generate\` will diff against a stale base schema.`,
  );
  process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  await main();
}
