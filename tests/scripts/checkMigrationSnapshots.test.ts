import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findBrokenChainLinks,
  findMissingSnapshotTags,
} from "../../scripts/check-migration-snapshots";

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
      {
        tag: "0000_a",
        id: "id-0",
        prevId: "00000000-0000-0000-0000-000000000000",
      },
      { tag: "0001_b", id: "id-1", prevId: "id-0" },
      { tag: "0002_c", id: "id-2", prevId: "id-1" },
    ];

    expect(findBrokenChainLinks(chain)).toEqual([]);
  });

  it("reports nothing for a single-entry chain", () => {
    const chain = [
      {
        tag: "0000_a",
        id: "id-0",
        prevId: "00000000-0000-0000-0000-000000000000",
      },
    ];

    expect(findBrokenChainLinks(chain)).toEqual([]);
  });

  // The exact production bug: 0009_snapshot.json existed and had a valid
  // shape, but its prevId pointed straight at 0004's id, silently skipping
  // 0005-0008 — an existence check alone would have missed this.
  it("catches a snapshot whose prevId skips over intermediate snapshots", () => {
    const chain = [
      { tag: "0004_busy_landau", id: "id-0004", prevId: "id-0003" },
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
      {
        tag: "0000_a",
        id: "id-0",
        prevId: "00000000-0000-0000-0000-000000000000",
      },
      { tag: "0001_b", id: "id-1", prevId: "wrong-prev-for-b" },
      { tag: "0002_c", id: "id-2", prevId: "wrong-prev-for-c" },
    ];

    expect(findBrokenChainLinks(chain)).toHaveLength(2);
  });
});

// Guards against this exact gap recurring: every tag `_journal.json` records
// must have a real, correctly-chained snapshot file on disk, checked against
// the actual repo state (not synthetic fixtures) so CI fails the moment the
// two drift apart.
describe("server/db/migrations snapshot completeness (repo state)", () => {
  it("has a snapshot file for every _journal.json entry", () => {
    const journal = JSON.parse(
      readFileSync("server/db/migrations/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string }[] };
    const existingSnapshotFilenames = readdirSync("server/db/migrations/meta");

    const missingTags = findMissingSnapshotTags(
      journal.entries.map((entry) => entry.tag),
      existingSnapshotFilenames,
    );

    expect(missingTags).toEqual([]);
  });

  it("has a correctly-chained prevId for every snapshot", () => {
    const journal = JSON.parse(
      readFileSync("server/db/migrations/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string }[] };

    const chain = journal.entries.map((entry) => {
      const prefix = entry.tag.match(/^(\d{4})_/)?.[1];
      const snapshot = JSON.parse(
        readFileSync(
          `server/db/migrations/meta/${prefix}_snapshot.json`,
          "utf8",
        ),
      ) as { id: string; prevId: string };

      return { tag: entry.tag, id: snapshot.id, prevId: snapshot.prevId };
    });

    expect(findBrokenChainLinks(chain)).toEqual([]);
  });

  // Exercises the actual CLI entry point (main() + the direct-invocation
  // guard), not just the pure functions above — this is what would have
  // caught the invokedDirectly regression under a symlinked path (e.g.
  // macOS's /tmp -> /private/tmp) that a pure-function-only test suite
  // cannot see.
  it("exits 0 and reports success when run as a script against real repo state", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-migration-snapshots.ts"],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "have a matching, correctly-chained snapshot file",
    );
  });
});
