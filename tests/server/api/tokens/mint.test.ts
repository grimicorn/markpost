import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";
import { TOKEN_PREFIX, hashToken } from "../../../../server/utils/tokens";

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

const { default: handler } =
  await import("../../../../server/api/tokens/index.post");

const userId = "user_abc123";

function buildEvent(contextUserId: string | undefined): H3Event {
  return { context: { userId: contextUserId } } as unknown as H3Event;
}

function buildBody(attributes: Record<string, unknown>) {
  return { data: { type: "api_tokens", attributes } };
}

function stubInsertResult(record: {
  id: string;
  name: string;
  prefix: string;
  hashedToken: string;
  createdAt: Date;
}) {
  const returning = vi.fn(() => Promise.resolve([record]));
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

describe("POST /api/tokens", () => {
  it("returns 201 with the plaintext token in the response (only time it is shown)", async () => {
    const dbRecord = {
      id: "token-uuid-1",
      name: "obsidian-laptop",
      prefix: "mp_live_abcd",
      hashedToken: "some-hash",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    };

    mockReadBody.mockResolvedValue(buildBody({ name: "obsidian-laptop" }));
    stubInsertResult(dbRecord);

    const response = await handler(buildEvent(userId));

    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 201);

    const data = (response as { data: { attributes: { token: string } } }).data;
    expect(data.attributes.token).toMatch(
      new RegExp(`^${TOKEN_PREFIX}[0-9a-f]{64}$`),
    );
  });

  it("stores a hash of the token, not the plaintext", async () => {
    let capturedHashedToken: string | undefined;

    const returning = vi.fn(async () => [
      {
        id: "token-uuid-1",
        name: "my-token",
        prefix: "mp_live_abcd",
        hashedToken: capturedHashedToken ?? "",
        createdAt: new Date(),
      },
    ]);
    const values = vi.fn((row: { hashedToken: string }) => {
      capturedHashedToken = row.hashedToken;
      return { returning };
    });
    insertMock.mockReturnValue({ values });

    mockReadBody.mockResolvedValue(buildBody({ name: "my-token" }));

    const response = await handler(buildEvent(userId));

    const plaintext = (response as { data: { attributes: { token: string } } })
      .data.attributes.token;

    expect(capturedHashedToken).toBeDefined();
    expect(capturedHashedToken).not.toBe(plaintext);
    expect(capturedHashedToken).toBe(hashToken(plaintext));
  });

  it("does not include the hashed token in the API response", async () => {
    const dbRecord = {
      id: "token-uuid-1",
      name: "my-token",
      prefix: "mp_live_abcd",
      hashedToken: "stored-hash-value",
      createdAt: new Date(),
    };

    mockReadBody.mockResolvedValue(buildBody({ name: "my-token" }));
    stubInsertResult(dbRecord);

    const response = await handler(buildEvent(userId));

    const responseString = JSON.stringify(response);
    expect(responseString).not.toContain("stored-hash-value");
    expect(responseString).not.toContain("hashedToken");
  });

  it("throws 422 when name is missing", async () => {
    mockReadBody.mockResolvedValue(buildBody({}));

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          expect.objectContaining({
            status: "422",
            detail: "Name is required",
          }),
        ],
      },
    });
  });

  it("throws 422 when name is not a string", async () => {
    mockReadBody.mockResolvedValue(buildBody({ name: 42 }));

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          expect.objectContaining({
            status: "422",
            detail: "Name must be a string",
          }),
        ],
      },
    });
  });

  it("throws 422 when the request body is empty (no body sent)", async () => {
    mockReadBody.mockResolvedValue(undefined);

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          expect.objectContaining({
            status: "422",
            detail: "Name is required",
          }),
        ],
      },
    });
  });

  it("throws 401 when the user is not authenticated", async () => {
    await expect(handler(buildEvent(undefined))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  });
});
