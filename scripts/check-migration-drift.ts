// Guard against the migration-bookkeeping drift that silently broke production.
//
// drizzle picks which migrations to run with a timestamp watermark and never
// compares hashes:
//
//   if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis)
//
// So if a journal `when` is edited after that migration was applied, or a
// migration lands out of order, drizzle either re-runs applied DDL or skips a
// migration forever. Neither is visible until a deploy fails. This check runs
// before `drizzle-kit migrate` and fails loudly with the specific mismatch.
import { neon } from "@neondatabase/serverless";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { pathToFileURL } from "node:url";

const MIGRATIONS_FOLDER = "server/db/migrations";

type RecordedMigration = {
  hash: string;
  created_at: string | number;
};

type JournalMigration = {
  hash: string;
  folderMillis: number;
};

export type DriftFinding = {
  kind: "unknown-hash" | "timestamp-drift" | "silently-skipped";
  detail: string;
};

function findWatermark(recorded: RecordedMigration[]): number {
  return recorded.reduce(
    (highest, row) => Math.max(highest, Number(row.created_at)),
    0,
  );
}

function findUnknownHashes(
  recorded: RecordedMigration[],
  journalByHash: Map<string, JournalMigration>,
): DriftFinding[] {
  return recorded
    .filter((row) => !journalByHash.has(row.hash))
    .map((row) => ({
      kind: "unknown-hash" as const,
      detail: `Recorded migration ${row.hash.slice(0, 12)}... is not in the journal. A migration file was deleted or its contents were edited after being applied.`,
    }));
}

function findTimestampDrift(
  recorded: RecordedMigration[],
  journalByHash: Map<string, JournalMigration>,
): DriftFinding[] {
  return recorded.flatMap((row) => {
    const journalEntry = journalByHash.get(row.hash);

    if (!journalEntry) {
      return [];
    }

    if (Number(row.created_at) === journalEntry.folderMillis) {
      return [];
    }

    return [
      {
        kind: "timestamp-drift" as const,
        detail: `Migration ${journalEntry.hash.slice(0, 12)}... is recorded as applied at ${row.created_at} but the journal says ${journalEntry.folderMillis}. The journal was rewritten after this migration ran; drizzle will re-apply already-applied DDL.`,
      },
    ];
  });
}

function findSilentlySkipped(
  recorded: RecordedMigration[],
  journal: JournalMigration[],
): DriftFinding[] {
  const recordedHashes = new Set(recorded.map((row) => row.hash));
  const watermark = findWatermark(recorded);

  return journal
    .filter((migration) => !recordedHashes.has(migration.hash))
    .filter((migration) => migration.folderMillis < watermark)
    .map((migration) => ({
      kind: "silently-skipped" as const,
      detail: `Migration ${migration.hash.slice(0, 12)}... (${migration.folderMillis}) was never applied but sits below the watermark ${watermark}. drizzle will never run it.`,
    }));
}

export function findMigrationDrift(
  recorded: RecordedMigration[],
  journal: JournalMigration[],
): DriftFinding[] {
  const journalByHash = new Map(
    journal.map((migration) => [migration.hash, migration]),
  );

  return [
    ...findUnknownHashes(recorded, journalByHash),
    ...findTimestampDrift(recorded, journalByHash),
    ...findSilentlySkipped(recorded, journal),
  ];
}

async function main(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL_UNPOOLED or DATABASE_URL is required to check migration drift",
    );
  }

  const sql = neon(databaseUrl);
  const journal = readMigrationFiles({
    migrationsFolder: MIGRATIONS_FOLDER,
  }) as JournalMigration[];

  // A fresh database has no bookkeeping table yet; that is not drift.
  const [{ exists: tableExists }] = await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    ) as exists
  `;

  if (!tableExists) {
    console.log(
      "No drizzle.__drizzle_migrations table yet — nothing to check.",
    );
    return;
  }

  const recorded = (await sql`
    select hash, created_at from drizzle.__drizzle_migrations order by created_at
  `) as RecordedMigration[];

  const findings = findMigrationDrift(recorded, journal);

  if (findings.length === 0) {
    console.log(
      `Migration bookkeeping is consistent (${recorded.length} applied, ${journal.length} in journal).`,
    );
    return;
  }

  console.error("Migration bookkeeping drift detected:\n");
  for (const finding of findings) {
    console.error(`  [${finding.kind}] ${finding.detail}`);
  }
  console.error(
    "\nRefusing to migrate. Reconcile drizzle.__drizzle_migrations with the journal first.",
  );
  process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  await main();
}
