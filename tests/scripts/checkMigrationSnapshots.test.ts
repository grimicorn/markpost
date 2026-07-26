import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findBrokenChainLinks,
  findMissingSnapshotTags,
  loadSnapshotChain,
} from "../../scripts/check-migration-snapshots";

const ROOT_SNAPSHOT_PREV_ID = "00000000-0000-0000-0000-000000000000";

const journalTags = [
  "0000_pretty_mystique",
  "0001_faithful_dust",
  "0002_yellow_shockwave",
];

describe("findMissingSnapshotTags", () => {
  it("reports nothing when every journal tag has a matching snapshot file", () => {
    const existingSnapshotFilenames = [
      "0000_snapshot.json",
      "0001_snapshot.json",
      "0002_snapshot.json",
      "_journal.json",
    ];

    expect(
      findMissingSnapshotTags(journalTags, existingSnapshotFilenames),
    ).toEqual([]);
  });

  it("reports nothing for an empty journal", () => {
    expect(findMissingSnapshotTags([], ["_journal.json"])).toEqual([]);
  });

  // The exact production gap: 0005-0008 were listed in _journal.json but had
  // no corresponding meta/000N_snapshot.json file on disk.
  it("catches a gap of missing snapshot files in the middle of the chain", () => {
    const journalTagsWithGap = [
      "0004_busy_landau",
      "0005_add_events_table",
      "0006_add_users_table",
      "0007_link_user_id_to_users",
      "0008_add_subscriptions_table",
      "0009_add_source_throttle_columns",
    ];
    const existingSnapshotFilenames = [
      "0004_snapshot.json",
      "0009_snapshot.json",
      "_journal.json",
    ];

    const missingTags = findMissingSnapshotTags(
      journalTagsWithGap,
      existingSnapshotFilenames,
    );

    expect(missingTags).toEqual([
      "0005_add_events_table",
      "0006_add_users_table",
      "0007_link_user_id_to_users",
      "0008_add_subscriptions_table",
    ]);
  });

  it("catches a single missing snapshot file", () => {
    const existingSnapshotFilenames = [
      "0000_snapshot.json",
      "0002_snapshot.json",
    ];

    expect(
      findMissingSnapshotTags(journalTags, existingSnapshotFilenames),
    ).toEqual(["0001_faithful_dust"]);
  });

  it("flags a malformed journal tag that has no numeric prefix", () => {
    expect(
      findMissingSnapshotTags(["not_a_numbered_tag"], ["0000_snapshot.json"]),
    ).toEqual(["not_a_numbered_tag"]);
  });

  it("ignores non-snapshot files present in the meta directory", () => {
    const existingSnapshotFilenames = [
      "0000_snapshot.json",
      "0001_snapshot.json",
      "0002_snapshot.json",
      "_journal.json",
      ".DS_Store",
    ];

    expect(
      findMissingSnapshotTags(journalTags, existingSnapshotFilenames),
    ).toEqual([]);
  });
});

describe("findBrokenChainLinks", () => {
  it("reports nothing when every snapshot's prevId matches the one before it", () => {
    const chain = [
      { tag: "0000_a", id: "id-0", prevId: ROOT_SNAPSHOT_PREV_ID },
      { tag: "0001_b", id: "id-1", prevId: "id-0" },
      { tag: "0002_c", id: "id-2", prevId: "id-1" },
    ];

    expect(findBrokenChainLinks(chain)).toEqual([]);
  });

  it("reports nothing for a single-entry chain rooted at the sentinel prevId", () => {
    const chain = [
      { tag: "0000_a", id: "id-0", prevId: ROOT_SNAPSHOT_PREV_ID },
    ];

    expect(findBrokenChainLinks(chain)).toEqual([]);
  });

  it("catches a first snapshot whose prevId isn't the root sentinel", () => {
    const chain = [{ tag: "0000_a", id: "id-0", prevId: "not-the-sentinel" }];

    const brokenLinks = findBrokenChainLinks(chain);

    expect(brokenLinks).toHaveLength(1);
    expect(brokenLinks[0]).toContain("0000_a");
    expect(brokenLinks[0]).toContain("root sentinel");
  });

  // The exact production bug: 0009_snapshot.json existed and had a valid
  // shape, but its prevId pointed straight at 0004's id, silently skipping
  // 0005-0008 — an existence check alone would have missed this.
  it("catches a snapshot whose prevId skips over intermediate snapshots", () => {
    const chain = [
      { tag: "0004_busy_landau", id: "id-0004", prevId: ROOT_SNAPSHOT_PREV_ID },
      { tag: "0005_add_events_table", id: "id-0005", prevId: "id-0004" },
      { tag: "0006_add_users_table", id: "id-0006", prevId: "id-0005" },
      { tag: "0007_link_user_id_to_users", id: "id-0007", prevId: "id-0006" },
      { tag: "0008_add_subscriptions_table", id: "id-0008", prevId: "id-0007" },
      {
        tag: "0009_add_source_throttle_columns",
        id: "id-0009",
        prevId: "id-0004", // should be id-0008
      },
    ];

    const brokenLinks = findBrokenChainLinks(chain);

    expect(brokenLinks).toHaveLength(1);
    expect(brokenLinks[0]).toContain("0009_add_source_throttle_columns");
    expect(brokenLinks[0]).toContain("id-0004");
    expect(brokenLinks[0]).toContain("0008_add_subscriptions_table");
  });

  it("catches multiple independent broken links", () => {
    const chain = [
      { tag: "0000_a", id: "id-0", prevId: ROOT_SNAPSHOT_PREV_ID },
      { tag: "0001_b", id: "id-1", prevId: "wrong-prev-for-b" },
      { tag: "0002_c", id: "id-2", prevId: "wrong-prev-for-c" },
    ];

    expect(findBrokenChainLinks(chain)).toHaveLength(2);
  });
});

describe("loadSnapshotChain", () => {
  const scratchDirectories: string[] = [];

  afterEach(() => {
    while (scratchDirectories.length > 0) {
      rmSync(scratchDirectories.pop() as string, {
        recursive: true,
        force: true,
      });
    }
  });

  function makeScratchMetaDir(): string {
    const directory = mkdtempSync(join(tmpdir(), "snapshot-chain-"));
    scratchDirectories.push(directory);
    return directory;
  }

  it("reads id and prevId out of each snapshot file in tag order", () => {
    const metaFolder = makeScratchMetaDir();
    writeFileSync(
      join(metaFolder, "0000_snapshot.json"),
      JSON.stringify({ id: "id-0", prevId: ROOT_SNAPSHOT_PREV_ID }),
    );
    writeFileSync(
      join(metaFolder, "0001_snapshot.json"),
      JSON.stringify({ id: "id-1", prevId: "id-0" }),
    );

    const chain = loadSnapshotChain(
      ["0000_pretty_mystique", "0001_faithful_dust"],
      metaFolder,
    );

    expect(chain).toEqual([
      {
        tag: "0000_pretty_mystique",
        id: "id-0",
        prevId: ROOT_SNAPSHOT_PREV_ID,
      },
      { tag: "0001_faithful_dust", id: "id-1", prevId: "id-0" },
    ]);
  });

  // A truncated/corrupted snapshot (e.g. a bad merge leaving `{}`) must not
  // silently read as `undefined === undefined` and pass the chain check.
  it("throws when a snapshot file is missing its id or prevId", () => {
    const metaFolder = makeScratchMetaDir();
    writeFileSync(join(metaFolder, "0000_snapshot.json"), JSON.stringify({}));

    expect(() =>
      loadSnapshotChain(["0000_pretty_mystique"], metaFolder),
    ).toThrow(/missing a string "id" or "prevId"/);
  });
});

// Guards against this exact gap recurring: every tag `_journal.json` records
// must have a real, correctly-chained snapshot file on disk, checked against
// the actual repo state (not synthetic fixtures) so CI fails the moment the
// two drift apart.
describe("server/db/migrations snapshot completeness (repo state)", () => {
  const META_FOLDER = "server/db/migrations/meta";

  function readRepoJournalTags(): string[] {
    const journal = JSON.parse(
      readFileSync(`${META_FOLDER}/_journal.json`, "utf8"),
    ) as { entries: { tag: string; idx: number }[] };

    return [...journal.entries]
      .sort((first, second) => first.idx - second.idx)
      .map((entry) => entry.tag);
  }

  it("has a snapshot file for every _journal.json entry", () => {
    const existingSnapshotFilenames = readdirSync(META_FOLDER);

    const missingTags = findMissingSnapshotTags(
      readRepoJournalTags(),
      existingSnapshotFilenames,
    );

    expect(missingTags).toEqual([]);
  });

  it("has a correctly-chained prevId for every snapshot", () => {
    const chain = loadSnapshotChain(readRepoJournalTags(), META_FOLDER);

    expect(findBrokenChainLinks(chain)).toEqual([]);
  });
});

// Exercises the actual CLI entry point (main(), the direct-invocation guard,
// and the exit-code/stderr wiring), not just the pure functions above — this
// is what would have caught the invokedDirectly regression under a symlinked
// path (e.g. macOS's /tmp -> /private/tmp) that a pure-function-only test
// suite cannot see, and what proves a real failure actually exits non-zero.
describe("check-migration-snapshots CLI", () => {
  const scratchDirectories: string[] = [];

  afterEach(() => {
    while (scratchDirectories.length > 0) {
      rmSync(scratchDirectories.pop() as string, {
        recursive: true,
        force: true,
      });
    }
  });

  function makeFixtureMigrationsFolder(): {
    migrationsFolder: string;
    metaFolder: string;
  } {
    const migrationsFolder = mkdtempSync(join(tmpdir(), "migrations-fixture-"));
    scratchDirectories.push(migrationsFolder);
    const metaFolder = join(migrationsFolder, "meta");
    mkdirSync(metaFolder, { recursive: true });
    return { migrationsFolder, metaFolder };
  }

  function runCli(migrationsFolder: string) {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-migration-snapshots.ts", migrationsFolder],
      { encoding: "utf8", cwd: process.cwd() },
    );
    expect(result.error).toBeUndefined();
    return result;
  }

  it("exits 0 and reports success when run against real repo state", () => {
    const result = runCli("server/db/migrations");

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "have a matching, correctly-chained snapshot file",
    );
  });

  it("exits 1 and reports the missing tag when a snapshot file is absent", () => {
    const { migrationsFolder, metaFolder } = makeFixtureMigrationsFolder();
    writeFileSync(
      join(metaFolder, "_journal.json"),
      JSON.stringify({
        entries: [
          { idx: 0, tag: "0000_a" },
          { idx: 1, tag: "0001_b" },
        ],
      }),
    );
    writeFileSync(
      join(metaFolder, "0000_snapshot.json"),
      JSON.stringify({ id: "id-0", prevId: ROOT_SNAPSHOT_PREV_ID }),
    );
    // 0001_snapshot.json is intentionally absent.

    const result = runCli(migrationsFolder);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing migration snapshot file(s)");
    expect(result.stderr).toContain("0001_b");
  });

  it("exits 1 and reports the broken link when a snapshot's prevId is wrong", () => {
    const { migrationsFolder, metaFolder } = makeFixtureMigrationsFolder();
    writeFileSync(
      join(metaFolder, "_journal.json"),
      JSON.stringify({
        entries: [
          { idx: 0, tag: "0000_a" },
          { idx: 1, tag: "0001_b" },
        ],
      }),
    );
    writeFileSync(
      join(metaFolder, "0000_snapshot.json"),
      JSON.stringify({ id: "id-0", prevId: ROOT_SNAPSHOT_PREV_ID }),
    );
    writeFileSync(
      join(metaFolder, "0001_snapshot.json"),
      JSON.stringify({ id: "id-1", prevId: "some-other-id" }),
    );

    const result = runCli(migrationsFolder);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Broken migration snapshot chain link(s)");
    expect(result.stderr).toContain("0001_b");
  });
});
