import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const selectMock = vi.fn();

vi.mock("../../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  count: (expr?: unknown) => ({ count: expr }),
  eq: (column: unknown, value: unknown) => ({ eq: { column, value } }),
  gte: (column: unknown, value: unknown) => ({ gte: { column, value } }),
  isNotNull: (column: unknown) => ({ isNotNull: column }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
    { raw: (str: string) => str },
  ),
}));

const mockCreateError = vi.fn((options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);

const handler = (await import("../../../../server/api/billing/usage.get"))
  .default;

const USER_ID = "user_abc123";

function buildEvent(contextUserId: string | undefined): H3Event {
  return { context: { userId: contextUserId } } as unknown as H3Event;
}

function stubRequireUser(returnedUserId: string | undefined) {
  vi.stubGlobal("requireUser", (event: H3Event) => {
    const contextUserId = (event.context as { userId?: string }).userId;
    if (!contextUserId) {
      throw mockCreateError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    return returnedUserId ?? contextUserId;
  });
}

function stubSelectSequence(results: unknown[][]) {
  let callIndex = 0;
  selectMock.mockImplementation(() => {
    const currentResults = results[callIndex] ?? [];
    callIndex++;

    const where = vi.fn(() => Promise.resolve(currentResults));
    const from = vi.fn(() => ({ where }));
    return { from };
  });
}

beforeEach(() => {
  vi.stubGlobal("createError", mockCreateError);
  stubRequireUser(USER_ID);
  mockCreateError.mockClear();
  selectMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/billing/usage", () => {
  it("throws 401 when the user is not authenticated", async () => {
    await expect(handler(buildEvent(undefined))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  });

  it("returns recordsSyncedThisMonth and connectedSourceCount", async () => {
    stubSelectSequence([[{ total: 42 }], [{ total: 3 }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toEqual({
      data: {
        recordsSyncedThisMonth: 42,
        connectedSourceCount: 3,
      },
    });
  });

  it("returns zeros when both queries return empty rows", async () => {
    stubSelectSequence([[], []]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toEqual({
      data: {
        recordsSyncedThisMonth: 0,
        connectedSourceCount: 0,
      },
    });
  });

  it("returns zeros when the database returns null values", async () => {
    stubSelectSequence([[{ total: null }], [{ total: null }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toEqual({
      data: {
        recordsSyncedThisMonth: 0,
        connectedSourceCount: 0,
      },
    });
  });

  it("coerces string counts to numbers", async () => {
    stubSelectSequence([[{ total: "15" }], [{ total: "2" }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toEqual({
      data: {
        recordsSyncedThisMonth: 15,
        connectedSourceCount: 2,
      },
    });
  });
});
