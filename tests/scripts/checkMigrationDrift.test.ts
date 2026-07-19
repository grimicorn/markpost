import { describe, expect, it } from "vitest";
import { findMigrationDrift } from "../../scripts/check-migration-drift";

const HASH_0003 = "a".repeat(64);
const HASH_0004 = "b".repeat(64);
const HASH_0005 = "c".repeat(64);

const MILLIS_0003 = 1782597559130;
const MILLIS_0004 = 1782607250405;
const MILLIS_0005 = 1782700000000;

const journal = [
  { hash: HASH_0003, folderMillis: MILLIS_0003 },
  { hash: HASH_0004, folderMillis: MILLIS_0004 },
  { hash: HASH_0005, folderMillis: MILLIS_0005 },
];

describe("findMigrationDrift", () => {
  it("reports nothing when every recorded migration matches the journal", () => {
    const recorded = [
      { hash: HASH_0003, created_at: MILLIS_0003 },
      { hash: HASH_0004, created_at: MILLIS_0004 },
    ];

    expect(findMigrationDrift(recorded, journal)).toEqual([]);
  });

  it("reports nothing for a database with no migrations applied yet", () => {
    expect(findMigrationDrift([], journal)).toEqual([]);
  });

  // The exact production failure: 0004 was recorded at 1782594506124 while the
  // journal said 1782607250405, dropping the watermark below 0004 itself so every
  // migrate run re-attempted its ALTER TABLE and died on "column already exists".
  it("catches a journal timestamp rewritten after the migration was applied", () => {
    const recorded = [
      { hash: HASH_0003, created_at: MILLIS_0003 },
      { hash: HASH_0004, created_at: 1782594506124 },
    ];

    const findings = findMigrationDrift(recorded, journal);

    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("timestamp-drift");
    expect(findings[0].detail).toContain("1782594506124");
    expect(findings[0].detail).toContain(String(MILLIS_0004));
  });

  it("catches a migration stranded below the watermark that will never run", () => {
    const recorded = [{ hash: HASH_0004, created_at: MILLIS_0004 }];

    const findings = findMigrationDrift(recorded, journal);

    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("silently-skipped");
    expect(findings[0].detail).toContain(String(MILLIS_0003));
  });

  it("does not flag unapplied migrations above the watermark as skipped", () => {
    const recorded = [
      { hash: HASH_0003, created_at: MILLIS_0003 },
      { hash: HASH_0004, created_at: MILLIS_0004 },
    ];

    // 0005 is pending and above the watermark — normal, drizzle will apply it.
    expect(findMigrationDrift(recorded, journal)).toEqual([]);
  });

  it("catches a recorded migration whose file was deleted or edited", () => {
    const recorded = [{ hash: "f".repeat(64), created_at: MILLIS_0003 }];

    const findings = findMigrationDrift(recorded, journal);

    expect(findings.some((finding) => finding.kind === "unknown-hash")).toBe(
      true,
    );
  });

  it("treats created_at as numeric when the driver returns bigint as a string", () => {
    const recorded = [
      { hash: HASH_0003, created_at: String(MILLIS_0003) },
      { hash: HASH_0004, created_at: String(MILLIS_0004) },
    ];

    expect(findMigrationDrift(recorded, journal)).toEqual([]);
  });
});
