import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";
import { records } from "../../../../server/db/schema";

const selectMock = vi.fn();
const mockFindSubscriptionByUserId = vi.fn();

vi.mock("../../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

// Spy-wrapped (not just pass-through) so a test can assert *which* column the
// monthly record count filters on — this is what proves the dashboard now
// counts by createdAt rather than syncedAt (issue #130), matching enforcement.
const andMock = vi.fn((...conditions: unknown[]) => ({ and: conditions }));
const countMock = vi.fn((expr?: unknown) => ({ count: expr }));
const eqMock = vi.fn((column: unknown, value: unknown) => ({
  eq: { column, value },
}));
const gteMock = vi.fn((column: unknown, value: unknown) => ({
  gte: { column, value },
}));
const isNotNullMock = vi.fn((column: unknown) => ({ isNotNull: column }));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => andMock(...args),
  count: (expr?: unknown) => countMock(expr),
  eq: (column: unknown, value: unknown) => eqMock(column, value),
  gte: (column: unknown, value: unknown) => gteMock(column, value),
  isNotNull: (column: unknown) => isNotNullMock(column),
}));

vi.mock("../../../../server/utils/billing", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../server/utils/billing")
  >("../../../../server/utils/billing");

  return {
    ...actual,
    findSubscriptionByUserId: (...args: unknown[]) =>
      mockFindSubscriptionByUserId(...args),
  };
});

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
  andMock.mockClear();
  countMock.mockClear();
  eqMock.mockClear();
  gteMock.mockClear();
  isNotNullMock.mockClear();
  mockFindSubscriptionByUserId.mockReset();
  mockFindSubscriptionByUserId.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("GET /api/billing/usage", () => {
  it("throws 401 when the user is not authenticated", async () => {
    await expect(handler(buildEvent(undefined))).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  });

  it("returns recordsCreatedThisMonth and connectedSourceCount", async () => {
    stubSelectSequence([[{ total: 42 }], [{ total: 3 }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        recordsCreatedThisMonth: 42,
        connectedSourceCount: 3,
      },
    });
  });

  it("returns zeros when both queries return empty rows", async () => {
    stubSelectSequence([[], []]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        recordsCreatedThisMonth: 0,
        connectedSourceCount: 0,
      },
    });
  });

  it("returns zeros when the database returns null values", async () => {
    stubSelectSequence([[{ total: null }], [{ total: null }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        recordsCreatedThisMonth: 0,
        connectedSourceCount: 0,
      },
    });
  });

  it("coerces string counts to numbers", async () => {
    stubSelectSequence([[{ total: "15" }], [{ total: "2" }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        recordsCreatedThisMonth: 15,
        connectedSourceCount: 2,
      },
    });
  });

  it("defaults to the hobby plan with an active status when the user has no subscription", async () => {
    stubSelectSequence([[{ total: 0 }], [{ total: 0 }]]);
    mockFindSubscriptionByUserId.mockResolvedValue(null);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        plan: "hobby",
        status: "active",
        trialEndsAt: null,
        trialDaysLeft: null,
        trialPercentElapsed: null,
      },
    });
  });

  it("returns the plan and status from the subscription when not trialing", async () => {
    stubSelectSequence([[{ total: 0 }], [{ total: 0 }]]);
    mockFindSubscriptionByUserId.mockResolvedValue({
      plan: "pro",
      status: "active",
      trialEndsAt: null,
    });

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        plan: "pro",
        status: "active",
        trialEndsAt: null,
        trialDaysLeft: null,
        trialPercentElapsed: null,
      },
    });
  });

  it("computes trial progress when the subscription is trialing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-27T00:00:00Z"));
    stubSelectSequence([[{ total: 0 }], [{ total: 0 }]]);
    mockFindSubscriptionByUserId.mockResolvedValue({
      plan: "pro",
      status: "trialing",
      trialEndsAt: new Date("2026-07-01T00:00:00Z"),
    });

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        plan: "pro",
        status: "trialing",
        trialEndsAt: "2026-07-01T00:00:00.000Z",
        trialDaysLeft: 4,
        trialPercentElapsed: 71,
      },
    });
  });

  it("does not compute trial progress when status is trialing but trialEndsAt is null", async () => {
    stubSelectSequence([[{ total: 0 }], [{ total: 0 }]]);
    mockFindSubscriptionByUserId.mockResolvedValue({
      plan: "pro",
      status: "trialing",
      trialEndsAt: null,
    });

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        trialDaysLeft: null,
        trialPercentElapsed: null,
      },
    });
  });

  it("counts the monthly records with a single createdAt+user predicate (a record created this month but not yet synced is included)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T15:30:00Z"));
    stubSelectSequence([[{ total: 7 }], [{ total: 0 }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response.data.recordsCreatedThisMonth).toBe(7);
    // Assert the composed where-clause, not just that eq/gte were each called
    // (eqMock also fires for the connected-source count in the same request):
    // this pins the count to *this* user AND the current month together.
    expect(andMock).toHaveBeenCalledWith(
      { eq: { column: records.userId, value: USER_ID } },
      {
        gte: {
          column: records.createdAt,
          value: new Date(Date.UTC(2026, 6, 1)),
        },
      },
    );
  });

  it("builds the monthly record count without any syncedAt predicate (a record created last month but synced this month is excluded)", async () => {
    stubSelectSequence([[{ total: 3 }], [{ total: 0 }]]);

    await handler(buildEvent(USER_ID));

    expect(gteMock).toHaveBeenCalledWith(records.createdAt, expect.any(Date));
    expect(gteMock).not.toHaveBeenCalledWith(
      records.syncedAt,
      expect.any(Date),
    );
    // The prior syncedAt-based dashboard query used isNotNull(records.syncedAt);
    // its absence here proves the switch to a pure createdAt count.
    expect(isNotNullMock).not.toHaveBeenCalled();
  });
});
