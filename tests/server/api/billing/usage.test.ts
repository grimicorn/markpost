import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const selectMock = vi.fn();
const mockFindSubscriptionByUserId = vi.fn();

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
  mockFindSubscriptionByUserId.mockReset();
  mockFindSubscriptionByUserId.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it("returns recordsSyncedThisMonth and connectedSourceCount", async () => {
    stubSelectSequence([[{ total: 42 }], [{ total: 3 }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        recordsSyncedThisMonth: 42,
        connectedSourceCount: 3,
      },
    });
  });

  it("returns zeros when both queries return empty rows", async () => {
    stubSelectSequence([[], []]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        recordsSyncedThisMonth: 0,
        connectedSourceCount: 0,
      },
    });
  });

  it("returns zeros when the database returns null values", async () => {
    stubSelectSequence([[{ total: null }], [{ total: null }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        recordsSyncedThisMonth: 0,
        connectedSourceCount: 0,
      },
    });
  });

  it("coerces string counts to numbers", async () => {
    stubSelectSequence([[{ total: "15" }], [{ total: "2" }]]);

    const response = await handler(buildEvent(USER_ID));

    expect(response).toMatchObject({
      data: {
        recordsSyncedThisMonth: 15,
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

    vi.useRealTimers();
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
});
