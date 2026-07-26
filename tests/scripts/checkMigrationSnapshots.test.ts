import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findMissingSnapshotTags } from "../../scripts/check-migration-snapshots";

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

// Guards against this exact gap recurring: every tag `_journal.json` records
// must have a real snapshot file on disk, checked against the actual repo
// state (not synthetic fixtures) so CI fails the moment the two drift apart.
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
});
