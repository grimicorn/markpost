import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const selectMock = vi.fn();

vi.mock("../../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ and: conditions }),
  count: () => ({ count: true }),
  desc: (column: unknown) => ({ desc: column }),
  eq: (column: unknown, value: unknown) => ({ eq: { column, value } }),
  like: (column: unknown, pattern: unknown) => ({ like: { column, pattern } }),
  lt: (column: unknown, value: unknown) => ({ lt: { column, value } }),
  or: (...conditions: unknown[]) => ({ or: conditions }),
  SQL: class {},
}));

const mockCreateError = vi.fn((options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});

let queryParams: Record<string, string> = {};
const mockGetQuery = vi.fn(() => queryParams);

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);

const handler = (await import("../../../../server/api/records/index.get"))
  .default;

const userId = "user_abc123";

function buildEvent(contextUserId: string | undefined): H3Event {
  return { context: { userId: contextUserId } } as unknown as H3Event;
}

function stubSelectResults(countRow: unknown, pageRows: unknown[]) {
  const countWhere = vi.fn(() => Promise.resolve([countRow]));
  const countFrom = vi.fn(() => ({ where: countWhere }));

  const pageLimit = vi.fn(() => Promise.resolve(pageRows));
  const pageOrderBy = vi.fn(() => ({ limit: pageLimit }));
  const pageWhere = vi.fn(() => ({ orderBy: pageOrderBy }));
  const pageFrom = vi.fn(() => ({ where: pageWhere }));

  let callCount = 0;
  selectMock.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return { from: countFrom };
    }

    return { from: pageFrom };
  });

  return { countWhere, pageWhere };
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

beforeEach(() => {
  vi.stubGlobal("createError", mockCreateError);
  vi.stubGlobal("getQuery", mockGetQuery);
  stubRequireUser(userId);
  mockCreateError.mockClear();
  selectMock.mockReset();
  queryParams = {};
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/records", () => {
  it("throws 401 when the user is not authenticated", async () => {
    await expect(handler(buildEvent(undefined))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  });

  it("returns an empty list when no records exist", async () => {
    stubSelectResults({ value: 0 }, []);

    const response = await handler(buildEvent(userId));

    expect(response).toMatchObject({ data: [] });
  });

  it("ignores an invalid filter[source] value and does not include a like condition", async () => {
    queryParams = { "filter[source]": "invalid_type" };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0];
    expect(whereArg).not.toMatchObject({
      and: expect.arrayContaining([
        expect.objectContaining({ like: expect.anything() }),
      ]),
    });
  });

  it("ignores an invalid filter[status] value and does not add a second eq condition", async () => {
    queryParams = { "filter[status]": "unknown_status" };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const noFilterWhereArg = countWhere.mock.calls[0]?.[0];
    const conditions = (noFilterWhereArg as { and: unknown[] }).and;
    expect(conditions).toHaveLength(1);
  });

  it("applies a LIKE filter when filter[source]=webhook", async () => {
    queryParams = { "filter[source]": "webhook" };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const conditions = whereArg.and;
    const hasLikeCondition = conditions.some(
      (condition) =>
        typeof condition === "object" &&
        condition !== null &&
        "like" in condition &&
        (condition as { like: { pattern: unknown } }).like.pattern ===
          "webhook/%",
    );
    expect(hasLikeCondition).toBe(true);
  });

  it("applies a status filter when filter[status]=error", async () => {
    queryParams = { "filter[status]": "error" };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const conditions = whereArg.and;
    const hasStatusCondition = conditions.some(
      (condition) =>
        typeof condition === "object" &&
        condition !== null &&
        "eq" in condition &&
        (condition as { eq: { value: unknown } }).eq.value === "error",
    );
    expect(hasStatusCondition).toBe(true);
  });
});
