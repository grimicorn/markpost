import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Record, NewRecord } from "../server/db/records";

const mockRecord: Record = {
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  createdAt: "2024-01-01T00:00:00.000Z",
  title: "Test Title",
  content: "Test Content",
};

const mockDbRecord = {
  ...mockRecord,
  createdAt: new Date("2024-01-01T00:00:00Z"),
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
    it("returns the record when found with createdAt as ISO string", async () => {
      mockFindFirst.mockResolvedValue(mockDbRecord);

      const result = await findRecord(mockRecord.uuid);

      expect(result).toEqual(mockRecord);
      expect(typeof result?.createdAt).toBe("string");
    });

    it("returns undefined when the record does not exist", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await findRecord("non-existent-uuid");

      expect(result).toBeUndefined();
    });
  });

  describe("listRecords", () => {
    it("returns all records with createdAt as ISO string", async () => {
      mockFindMany.mockResolvedValue([mockDbRecord]);

      const result = await listRecords();

      expect(result).toEqual([mockRecord]);
      expect(typeof result[0]?.createdAt).toBe("string");
    });

    it("returns an empty array when no records exist", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await listRecords();

      expect(result).toEqual([]);
    });
  });

  describe("createRecord", () => {
    it("inserts and returns the new record with createdAt as ISO string", async () => {
      mockInsertReturning.mockResolvedValue([mockDbRecord]);

      const input: NewRecord = { title: "Test Title", content: "Test Content" };
      const result = await createRecord(input);

      expect(result).toEqual(mockRecord);
      expect(result.uuid).toBeDefined();
      expect(typeof result.createdAt).toBe("string");
    });

    it("trims whitespace from title and content before inserting", async () => {
      mockInsertReturning.mockResolvedValue([mockDbRecord]);

      const input: NewRecord = {
        title: "  Test Title  ",
        content: "  Test Content  ",
      };
      await createRecord(input);

      expect(mockInsertReturning).toHaveBeenCalledTimes(1);
    });

    it("throws when title is empty", async () => {
      const input: NewRecord = { title: "", content: "Test Content" };

      await expect(createRecord(input)).rejects.toThrow(
        "title must not be empty",
      );
    });

    it("throws when title is whitespace only", async () => {
      const input: NewRecord = { title: "   ", content: "Test Content" };

      await expect(createRecord(input)).rejects.toThrow(
        "title must not be empty",
      );
    });

    it("throws when content is empty", async () => {
      const input: NewRecord = { title: "Test Title", content: "" };

      await expect(createRecord(input)).rejects.toThrow(
        "content must not be empty",
      );
    });

    it("throws when content is whitespace only", async () => {
      const input: NewRecord = { title: "Test Title", content: "   " };

      await expect(createRecord(input)).rejects.toThrow(
        "content must not be empty",
      );
    });
  });

  describe("deleteRecord", () => {
    it("deletes the record and returns it with createdAt as ISO string", async () => {
      mockDeleteReturning.mockResolvedValue([mockDbRecord]);

      const result = await deleteRecord(mockRecord.uuid);

      expect(result).toEqual(mockRecord);
      expect(typeof result?.createdAt).toBe("string");
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
        createdAt: "2024-01-01T00:00:00.000Z",
        title: "A title",
        content: "Some content",
      };

      expect(Object.keys(record)).toHaveLength(4);
      expect(record.uuid).toBeDefined();
      expect(record.createdAt).toBeDefined();
      expect(record.title).toBeDefined();
      expect(record.content).toBeDefined();
    });

    it("has createdAt as a string in ISO 8601 format", () => {
      const record: Record = {
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: "2024-01-01T00:00:00.000Z",
        title: "A title",
        content: "Some content",
      };

      expect(typeof record.createdAt).toBe("string");
      expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
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
