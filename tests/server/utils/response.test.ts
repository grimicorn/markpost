import { describe, it, expect } from "vitest";
import {
  recordSerializer,
  paginationMeta,
  paginationLinks,
} from "../../../server/utils/response";

const baseRecord = {
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  createdAt: new Date("2024-01-15T10:00:00Z"),
  userId: "user_abc123",
  title: "Test Post",
  content: "Some content here",
};

describe("recordSerializer", () => {
  it("returns the correct JSON API shape for a valid record", () => {
    const result = recordSerializer(baseRecord);

    expect(result).toEqual({
      type: "records",
      id: baseRecord.uuid,
      attributes: {
        uuid: baseRecord.uuid,
        createdAt: baseRecord.createdAt,
        userId: baseRecord.userId,
        title: baseRecord.title,
        content: baseRecord.content,
      },
      links: {
        self: `/api/records/${baseRecord.uuid}`,
      },
    });
  });

  it("returns null for null input", () => {
    expect(recordSerializer(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(recordSerializer(undefined)).toBeNull();
  });
});

describe("paginationMeta", () => {
  it("returns total, size, and hasMore", () => {
    const result = paginationMeta({ total: 42, size: 10, hasMore: true });

    expect(result).toEqual({ total: 42, size: 10, hasMore: true });
  });

  it("reflects hasMore false when on the last page", () => {
    const result = paginationMeta({ total: 5, size: 10, hasMore: false });

    expect(result.hasMore).toBe(false);
  });
});

describe("paginationLinks", () => {
  it("builds next link when hasMore is true and afterCursor is set", () => {
    const result = paginationLinks({
      afterCursor: "some-uuid",
      prevCursor: null,
      size: 10,
      hasMore: true,
    });

    expect(result.next).toBe(
      "/api/records?page%5Bafter%5D=some-uuid&page%5Bsize%5D=10",
    );
    expect(result.prev).toBeNull();
  });

  it("returns null for next when hasMore is false", () => {
    const result = paginationLinks({
      afterCursor: "some-uuid",
      prevCursor: null,
      size: 10,
      hasMore: false,
    });

    expect(result.next).toBeNull();
  });

  it("returns null for next when afterCursor is null even if hasMore is true", () => {
    const result = paginationLinks({
      afterCursor: null,
      prevCursor: null,
      size: 10,
      hasMore: true,
    });

    expect(result.next).toBeNull();
  });

  it("builds prev link when prevCursor is set", () => {
    const result = paginationLinks({
      afterCursor: null,
      prevCursor: "prev-uuid",
      size: 10,
      hasMore: false,
    });

    expect(result.prev).toBe(
      "/api/records?page%5Bafter%5D=prev-uuid&page%5Bsize%5D=10",
    );
  });

  it("returns null for prev when prevCursor is null", () => {
    const result = paginationLinks({
      afterCursor: null,
      prevCursor: null,
      size: 10,
      hasMore: false,
    });

    expect(result.prev).toBeNull();
  });
});
