import { describe, expect, it } from "vitest";
import {
  buildRecordListResponse,
  parsePageSize,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../../../server/utils/pagination";

function makeRecord(index: number) {
  return {
    uuid: `uuid-${index}`,
    createdAt: new Date(`2024-01-${String(index).padStart(2, "0")}T10:00:00Z`),
    userId: "user_abc123",
    title: `Title ${index}`,
    content: `Content ${index}`,
  };
}

describe("parsePageSize", () => {
  it("returns the default when no value is provided", () => {
    expect(parsePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("returns the default for non-numeric input", () => {
    expect(parsePageSize("abc")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("returns the default for values below 1", () => {
    expect(parsePageSize("0")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("-5")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("caps the value at the maximum", () => {
    expect(parsePageSize("500")).toBe(MAX_PAGE_SIZE);
  });

  it("returns the requested size when within range", () => {
    expect(parsePageSize("25")).toBe(25);
  });
});

describe("buildRecordListResponse", () => {
  it("returns the first page with a next link when more records exist", () => {
    const fetched = [makeRecord(5), makeRecord(4), makeRecord(3)];

    const response = buildRecordListResponse({
      records: fetched,
      size: 2,
      total: 10,
      prevCursor: null,
    });

    expect(response.data).toHaveLength(2);
    expect(response.data[0].id).toBe("uuid-5");
    expect(response.data[1].id).toBe("uuid-4");
    expect(response.meta).toEqual({ total: 10, size: 2, hasMore: true });
    expect(response.links?.next).toBe(
      "/api/records?page%5Bafter%5D=uuid-4&page%5Bsize%5D=2",
    );
    expect(response.links?.prev).toBeNull();
  });

  it("returns a subsequent page with prev link and no next on the last page", () => {
    const fetched = [makeRecord(2), makeRecord(1)];

    const response = buildRecordListResponse({
      records: fetched,
      size: 2,
      total: 4,
      prevCursor: "uuid-3",
    });

    expect(response.data).toHaveLength(2);
    expect(response.meta).toEqual({ total: 4, size: 2, hasMore: false });
    expect(response.links?.next).toBeNull();
    expect(response.links?.prev).toBe(
      "/api/records?page%5Bafter%5D=uuid-3&page%5Bsize%5D=2",
    );
  });

  it("filters out records that serialize to null", () => {
    const fetched = [
      makeRecord(3),
      null as unknown as ReturnType<typeof makeRecord>,
      makeRecord(1),
    ];

    const response = buildRecordListResponse({
      records: fetched,
      size: 3,
      total: 3,
      prevCursor: null,
    });

    expect(response.data).toHaveLength(2);
    expect(response.data.map((resource) => resource.id)).toEqual([
      "uuid-3",
      "uuid-1",
    ]);
  });

  it("returns empty data with null links when there are no records", () => {
    const response = buildRecordListResponse({
      records: [],
      size: 100,
      total: 0,
      prevCursor: null,
    });

    expect(response.data).toEqual([]);
    expect(response.meta).toEqual({ total: 0, size: 100, hasMore: false });
    expect(response.links?.next).toBeNull();
    expect(response.links?.prev).toBeNull();
  });
});
