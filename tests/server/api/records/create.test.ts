import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const insertMock = vi.fn();

vi.mock("../../../../server/db", () => ({
  getDb: () => ({ insert: insertMock }),
}));

const mockCreateError = vi.fn((options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});

const mockReadBody = vi.fn();
const mockSetResponseStatus = vi.fn();

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);

const handler = (await import("../../../../server/api/records/index.post"))
  .default;

const userId = "user_abc123";

const sampleRecord = {
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  createdAt: new Date("2024-01-15T10:00:00Z"),
  userId,
  title: "My Title",
  content: "My Content",
};

function buildEvent(contextUserId: string | undefined): H3Event {
  return { context: { userId: contextUserId } } as unknown as H3Event;
}

function buildBody(attributes: Record<string, unknown>) {
  return { data: { type: "records", attributes } };
}

function stubInsertResult(rows: unknown[]) {
  const returning = vi.fn(() => Promise.resolve(rows));
  const values = vi.fn(() => ({ returning }));
  insertMock.mockReturnValue({ values });
  return { values, returning };
}

beforeEach(() => {
  vi.stubGlobal("createError", mockCreateError);
  vi.stubGlobal("readBody", mockReadBody);
  vi.stubGlobal("setResponseStatus", mockSetResponseStatus);
  mockCreateError.mockClear();
  mockReadBody.mockClear();
  mockSetResponseStatus.mockClear();
  insertMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/records", () => {
  it("returns a 201 with the serialized record on valid input", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({ title: "My Title", content: "My Content" }),
    );
    stubInsertResult([sampleRecord]);

    const response = await handler(buildEvent(userId));

    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 201);
    expect(response).toEqual({
      data: {
        type: "records",
        id: sampleRecord.uuid,
        attributes: {
          uuid: sampleRecord.uuid,
          createdAt: sampleRecord.createdAt,
          userId,
          title: sampleRecord.title,
          content: sampleRecord.content,
        },
        links: { self: `/api/records/${sampleRecord.uuid}` },
      },
    });
  });

  it("throws a 422 with one error when title is missing", async () => {
    mockReadBody.mockResolvedValue(buildBody({ content: "My Content" }));

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          {
            status: "422",
            title: "Invalid Attribute",
            detail: "Title is required",
            source: { pointer: "/data/attributes/title" },
          },
        ],
      },
    });
  });

  it("throws a 422 with one error when content is missing", async () => {
    mockReadBody.mockResolvedValue(buildBody({ title: "My Title" }));

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          {
            status: "422",
            title: "Invalid Attribute",
            detail: "Content is required",
            source: { pointer: "/data/attributes/content" },
          },
        ],
      },
    });
  });

  it("throws a 422 with two errors when both title and content are missing", async () => {
    mockReadBody.mockResolvedValue(buildBody({}));

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          {
            status: "422",
            title: "Invalid Attribute",
            detail: "Title is required",
            source: { pointer: "/data/attributes/title" },
          },
          {
            status: "422",
            title: "Invalid Attribute",
            detail: "Content is required",
            source: { pointer: "/data/attributes/content" },
          },
        ],
      },
    });
  });

  it("throws a 401 when the user is not authenticated", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({ title: "My Title", content: "My Content" }),
    );

    await expect(handler(buildEvent(undefined))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  });
});
