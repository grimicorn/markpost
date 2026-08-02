import { describe, expect, it } from "vitest";
import {
  buildRecordExport,
  RECORD_EXPORT_LIMIT,
} from "../../../server/utils/recordExport";

const userId = "user_abc123";

function makeRecordRow(index: number) {
  return {
    uuid: `uuid-${index}`,
    createdAt: new Date(`2024-06-${String(index).padStart(2, "0")}T10:00:00Z`),
    userId,
    title: `Record ${index}`,
    content: `Body ${index}`,
    source: "webhook/github",
    sourceId: `src-${index}`,
    status: "synced",
    filePath: `/vault/record-${index}.md`,
    tags: ["a", "b"],
    frontmatter: { key: "value" },
    syncedAt: new Date(`2024-06-${String(index).padStart(2, "0")}T11:00:00Z`),
    errorMessage: null,
  };
}

describe("buildRecordExport", () => {
  it("serializes createdAt and syncedAt as ISO strings", () => {
    const row = makeRecordRow(1);

    const { rows } = buildRecordExport([row]);

    expect(rows[0].createdAt).toBe(row.createdAt.toISOString());
    expect(rows[0].syncedAt).toBe(row.syncedAt.toISOString());
  });

  it("serializes a null syncedAt as null", () => {
    const row = { ...makeRecordRow(1), syncedAt: null };

    const { rows } = buildRecordExport([row]);

    expect(rows[0].syncedAt).toBeNull();
  });

  it("omits userId from the exported row", () => {
    const { rows } = buildRecordExport([makeRecordRow(1)]);

    expect(rows[0]).not.toHaveProperty("userId");
  });

  it("preserves tags, frontmatter, and errorMessage", () => {
    const { rows } = buildRecordExport([makeRecordRow(1)]);

    expect(rows[0].tags).toEqual(["a", "b"]);
    expect(rows[0].frontmatter).toEqual({ key: "value" });
    expect(rows[0].errorMessage).toBeNull();
  });

  it("returns an empty set with isTruncated false for no rows", () => {
    const result = buildRecordExport([]);

    expect(result.rows).toEqual([]);
    expect(result.isTruncated).toBe(false);
  });

  it("does not truncate when rows are within the limit", () => {
    const rows = [makeRecordRow(3), makeRecordRow(2), makeRecordRow(1)];

    const result = buildRecordExport(rows);

    expect(result.rows).toHaveLength(3);
    expect(result.isTruncated).toBe(false);
  });

  it("does not flag truncation at exactly the limit", () => {
    const fixedCreatedAt = new Date("2024-06-01T10:00:00Z");
    const atLimitRows = Array.from(
      { length: RECORD_EXPORT_LIMIT },
      (_, index) => ({
        ...makeRecordRow(1),
        uuid: `uuid-${index}`,
        createdAt: fixedCreatedAt,
        syncedAt: null,
      }),
    );

    const result = buildRecordExport(atLimitRows);

    expect(result.rows).toHaveLength(RECORD_EXPORT_LIMIT);
    expect(result.isTruncated).toBe(false);
  });

  it("caps at the limit, flags truncation, and keeps the leading rows", () => {
    const fixedCreatedAt = new Date("2024-06-01T10:00:00Z");
    const overLimitRows = Array.from(
      { length: RECORD_EXPORT_LIMIT + 1 },
      (_, index) => ({
        ...makeRecordRow(1),
        uuid: `uuid-${index}`,
        createdAt: fixedCreatedAt,
        syncedAt: null,
      }),
    );

    const result = buildRecordExport(overLimitRows);

    expect(result.rows).toHaveLength(RECORD_EXPORT_LIMIT);
    expect(result.isTruncated).toBe(true);
    // The caller pre-sorts newest-first, so truncation must drop the tail
    // (oldest), keeping the leading window intact.
    expect(result.rows[0].uuid).toBe("uuid-0");
    expect(result.rows[RECORD_EXPORT_LIMIT - 1].uuid).toBe(
      `uuid-${RECORD_EXPORT_LIMIT - 1}`,
    );
  });
});
