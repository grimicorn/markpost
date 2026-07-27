import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";
import { SOURCE_TYPES } from "../../../../shared/utils/sourceTypes";

const selectMock = vi.fn();

vi.mock("../../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ and: conditions }),
  count: () => ({ count: true }),
  desc: (column: unknown) => ({ desc: column }),
  eq: (column: unknown, value: unknown) => ({ eq: { column, value } }),
  ilike: (column: unknown, pattern: unknown) => ({
    ilike: { column, pattern },
  }),
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

let queryParams: Record<string, string | string[]> = {};
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
    await expect(handler(buildEvent(undefined))).rejects.toMatchObject({
      statusCode: 401,
    });
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

  it("throws 400 for an invalid filter[source] value instead of returning an unfiltered list", async () => {
    queryParams = { "filter[source]": "invalid_type" };
    stubSelectResults({ value: 0 }, []);

    await expect(handler(buildEvent(userId))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 400,
      data: {
        errors: [
          {
            status: "400",
            title: "Invalid filter[source]",
            detail: expect.stringContaining("filter[source] must be one of"),
            source: { parameter: "filter[source]" },
          },
        ],
      },
    });
  });

  // Pinned literal (not derived from SOURCE_TYPES) so dropping a type from the
  // shared constant fails this test, rather than silently shrinking the
  // it.each below along with it. (The coupling with what POST /api/sources
  // accepts is covered separately in tests/server/api/sources/create.test.ts,
  // which imports this same constant.) "rss" is deliberately absent — there's
  // no polling infrastructure to service it, so it's rejected at creation
  // (see tests/server/api/sources/create.test.ts's 'rss' 422 test).
  it("pins the shared SOURCE_TYPES contract to the six known source types", () => {
    expect(SOURCE_TYPES).toEqual([
      "webhook",
      "email",
      "stripe",
      "github",
      "zapier",
      "shortcuts",
    ]);
  });

  it("uses the first value when filter[source] is repeated in the query string", async () => {
    queryParams = { "filter[source]": ["webhook", "email"] };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const conditions = whereArg.and;
    const hasWebhookLikeCondition = conditions.some(
      (condition) =>
        typeof condition === "object" &&
        condition !== null &&
        "like" in condition &&
        (condition as { like: { pattern: unknown } }).like.pattern ===
          "webhook/%",
    );
    expect(hasWebhookLikeCondition).toBe(true);
  });

  it.each(SOURCE_TYPES)(
    "applies a LIKE filter when filter[source]=%s",
    async (sourceType) => {
      queryParams = { "filter[source]": sourceType };
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
            `${sourceType}/%`,
      );
      expect(hasLikeCondition).toBe(true);
    },
  );

  it("ignores an empty filter[source] value rather than treating it as invalid", async () => {
    queryParams = { "filter[source]": "" };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    expect(whereArg.and).toHaveLength(1);
  });

  it("ignores an invalid filter[status] value and does not add a second eq condition", async () => {
    queryParams = { "filter[status]": "unknown_status" };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const noFilterWhereArg = countWhere.mock.calls[0]?.[0];
    const conditions = (noFilterWhereArg as { and: unknown[] }).and;
    expect(conditions).toHaveLength(1);
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

  type QueryCondition = {
    or: { ilike: { column: unknown; pattern: unknown } }[];
  };

  function isIlikeBranch(branch: unknown): boolean {
    return typeof branch === "object" && branch !== null && "ilike" in branch;
  }

  // filter[q] matches records via an `or(ilike(title), ilike(content))`
  // condition nested inside the top-level `and`. The cursor predicate is
  // also shaped `{ or: [...] }` under this mock, so narrow to `or` branches
  // that are themselves non-empty and entirely ILIKE conditions, to avoid
  // matching the cursor (or an empty/partial `or` from a regression).
  function findQueryCondition(
    conditions: unknown[],
  ): QueryCondition | undefined {
    return conditions.find((condition) => {
      if (typeof condition !== "object" || condition === null) {
        return false;
      }
      if (!("or" in condition)) {
        return false;
      }

      const branches = (condition as { or: unknown[] }).or;
      if (!Array.isArray(branches) || branches.length === 0) {
        return false;
      }

      return branches.every(isIlikeBranch);
    }) as QueryCondition | undefined;
  }

  // The two ends of an `or(ilike(title), ilike(content))` condition, as
  // column names, in the order returned by buildFilterConditions.
  function matchedColumnNames(queryCondition: QueryCondition | undefined) {
    return queryCondition?.or.map(
      (condition) => (condition.ilike.column as { name?: string })?.name,
    );
  }

  it("applies an ILIKE filter on title OR content when filter[q] is set", async () => {
    queryParams = { "filter[q]": "invoice" };
    const { countWhere, pageWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const queryCondition = findQueryCondition(whereArg.and);
    expect(queryCondition?.or).toHaveLength(2);
    expect(
      queryCondition?.or.every(
        (condition) => condition.ilike.pattern === "%invoice%",
      ),
    ).toBe(true);

    // The page query builds its own conditions independently of the count
    // query, so a change that only updates one of them must still fail here.
    const pageWhereArg = pageWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const pageQueryCondition = findQueryCondition(pageWhereArg.and);
    expect(pageQueryCondition?.or).toHaveLength(2);
  });

  it("matches on records.content, not just records.title, for filter[q]", async () => {
    queryParams = { "filter[q]": "invoice" };
    const { countWhere, pageWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const queryCondition = findQueryCondition(whereArg.and);
    expect(matchedColumnNames(queryCondition)).toEqual(["title", "content"]);

    const pageWhereArg = pageWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const pageQueryCondition = findQueryCondition(pageWhereArg.and);
    expect(matchedColumnNames(pageQueryCondition)).toEqual([
      "title",
      "content",
    ]);
  });

  it("trims whitespace from filter[q] before searching", async () => {
    queryParams = { "filter[q]": "  invoice  " };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const queryCondition = findQueryCondition(whereArg.and);
    expect(matchedColumnNames(queryCondition)).toEqual(["title", "content"]);
    expect(
      queryCondition?.or.every(
        (condition) => condition.ilike.pattern === "%invoice%",
      ),
    ).toBe(true);
  });

  it("escapes LIKE wildcard characters in filter[q]", async () => {
    queryParams = { "filter[q]": "100%_off\\" };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    const queryCondition = findQueryCondition(whereArg.and);
    expect(matchedColumnNames(queryCondition)).toEqual(["title", "content"]);
    expect(
      queryCondition?.or.every(
        (condition) => condition.ilike.pattern === "%100\\%\\_off\\\\%",
      ),
    ).toBe(true);
  });

  it("ignores an empty or whitespace-only filter[q] and does not add an ILIKE condition", async () => {
    queryParams = { "filter[q]": "   " };
    const { countWhere } = stubSelectResults({ value: 0 }, []);

    await handler(buildEvent(userId));

    const whereArg = countWhere.mock.calls[0]?.[0] as { and: unknown[] };
    expect(whereArg.and).toHaveLength(1);
    expect(findQueryCondition(whereArg.and)).toBeUndefined();
  });
});
