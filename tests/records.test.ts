import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Record, NewRecord } from "../server/db/records";

const mockRecord: Record = {
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  title: "Test Title",
  content: "Test Content",
};

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockInsertReturning = vi.fn();
const mockDeleteReturning = vi.fn();

vi.mock("../server/db/index", () => ({
  getDb: () => ({
    query: {
      records: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
    },
    insert: () => ({
      values: () => ({
        returning: () => mockInsertReturning(),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => mockDeleteReturning(),
      }),
    }),
  }),
}));

vi.mock("../server/db/schema", () => ({
  records: {
    uuid: "uuid",
    title: "title",
    content: "content",
    createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

const { findRecord, listRecords, createRecord, deleteRecord } =
  await import("../server/db/records");

describe("records repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findRecord", () => {
    it("returns the record when found", async () => {
      mockFindFirst.mockResolvedValue(mockRecord);

      const result = await findRecord(mockRecord.uuid);

      expect(result).toEqual(mockRecord);
    });

    it("returns undefined when the record does not exist", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await findRecord("non-existent-uuid");

      expect(result).toBeUndefined();
    });
  });

  describe("listRecords", () => {
    it("returns all records", async () => {
      const recordList: Record[] = [mockRecord];
      mockFindMany.mockResolvedValue(recordList);

      const result = await listRecords();

      expect(result).toEqual(recordList);
    });

    it("returns an empty array when no records exist", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await listRecords();

      expect(result).toEqual([]);
    });
  });

  describe("createRecord", () => {
    it("inserts and returns the new record with server-generated uuid and createdAt", async () => {
      mockInsertReturning.mockResolvedValue([mockRecord]);

      const input: NewRecord = { title: "Test Title", content: "Test Content" };
      const result = await createRecord(input);

      expect(result).toEqual(mockRecord);
      expect(result.uuid).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });
  });

  describe("deleteRecord", () => {
    it("deletes the record and returns it", async () => {
      mockDeleteReturning.mockResolvedValue([mockRecord]);

      const result = await deleteRecord(mockRecord.uuid);

      expect(result).toEqual(mockRecord);
    });

    it("returns undefined when the record does not exist", async () => {
      mockDeleteReturning.mockResolvedValue([]);

      const result = await deleteRecord("non-existent-uuid");

      expect(result).toBeUndefined();
    });
  });

  describe("Record type", () => {
    it("has exactly four fields: uuid, createdAt, title, content", () => {
      const record: Record = {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        title: "A title",
        content: "Some content",
      };

      expect(Object.keys(record)).toHaveLength(4);
      expect(record.uuid).toBeDefined();
      expect(record.createdAt).toBeDefined();
      expect(record.title).toBeDefined();
      expect(record.content).toBeDefined();
    });
  });

  describe("NewRecord type", () => {
    it("only includes title and content — uuid and createdAt are excluded", () => {
      const newRecord: NewRecord = {
        title: "A title",
        content: "Some content",
      };

      expect(Object.keys(newRecord)).toHaveLength(2);
      expect(newRecord.title).toBe("A title");
      expect(newRecord.content).toBe("Some content");
    });
  });
});
