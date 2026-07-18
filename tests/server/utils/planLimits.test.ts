import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { records, sources } from "../../../server/db/schema";

const selectMock = vi.fn();
const mockFindSubscriptionByUserId = vi.fn();

vi.mock("../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

// Spy-wrapped (not just pass-through) so tests can assert *which* column each
// query filters on — this is what actually proves the record cap counts by
// createdAt rather than syncedAt (see server/utils/planLimits.ts).
const andMock = vi.fn((...conditions: unknown[]) => ({ and: conditions }));
const countMock = vi.fn((expr?: unknown) => ({ count: expr }));
const eqMock = vi.fn((column: unknown, value: unknown) => ({
  eq: { column, value },
}));
const gteMock = vi.fn((column: unknown, value: unknown) => ({
  gte: { column, value },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => andMock(...args),
  count: (expr?: unknown) => countMock(expr),
  eq: (column: unknown, value: unknown) => eqMock(column, value),
  gte: (column: unknown, value: unknown) => gteMock(column, value),
}));

vi.mock("../../../server/utils/billing", async () => {
  const actual = await vi.importActual<
    typeof import("../../../server/utils/billing")
  >("../../../server/utils/billing");

  return {
    ...actual,
    findSubscriptionByUserId: (...args: unknown[]) =>
      mockFindSubscriptionByUserId(...args),
  };
});

const { assertWithinRecordLimit, assertWithinSourceLimit } =
  await import("../../../server/utils/planLimits");

const { HOBBY_MONTHLY_RECORD_LIMIT, HOBBY_CONNECTED_SOURCE_LIMIT } =
  await import("../../../shared/utils/planLimits");

const USER_ID = "user_abc123";

function stubSelectResult(total: number | string | null) {
  const where = vi.fn(() => Promise.resolve([{ total }]));
  const from = vi.fn(() => ({ where }));
  selectMock.mockReturnValue({ from });
  return { from, where };
}

beforeEach(() => {
  selectMock.mockReset();
  mockFindSubscriptionByUserId.mockReset();
  andMock.mockClear();
  countMock.mockClear();
  eqMock.mockClear();
  gteMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("assertWithinRecordLimit", () => {
  it("defaults a user with no subscription row to the hobby plan and allows a write under the cap", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue(null);
    stubSelectResult(HOBBY_MONTHLY_RECORD_LIMIT - 1);

    await expect(assertWithinRecordLimit(USER_ID)).resolves.toBeUndefined();
  });

  it("throws a 403 ApiError when a hobby user is exactly at the monthly record cap", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "hobby" });
    stubSelectResult(HOBBY_MONTHLY_RECORD_LIMIT);

    await expect(assertWithinRecordLimit(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      errors: [
        expect.objectContaining({
          status: "403",
          detail: expect.stringContaining(String(HOBBY_MONTHLY_RECORD_LIMIT)),
        }),
      ],
    });
  });

  it("throws when a hobby user is already over the monthly record cap", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "hobby" });
    stubSelectResult(HOBBY_MONTHLY_RECORD_LIMIT + 5);

    await expect(assertWithinRecordLimit(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("does not query the record count for a pro user (no cap applies)", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "pro" });

    await expect(assertWithinRecordLimit(USER_ID)).resolves.toBeUndefined();
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("coerces a null or string count from the database to a number", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "hobby" });
    stubSelectResult(null);

    await expect(assertWithinRecordLimit(USER_ID)).resolves.toBeUndefined();

    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "hobby" });
    stubSelectResult(String(HOBBY_MONTHLY_RECORD_LIMIT));

    await expect(assertWithinRecordLimit(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("counts by createdAt (not syncedAt), scoped to the given user and the current calendar month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T15:30:00Z"));
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "hobby" });
    stubSelectResult(0);

    await assertWithinRecordLimit(USER_ID);

    expect(eqMock).toHaveBeenCalledWith(records.userId, USER_ID);
    expect(gteMock).toHaveBeenCalledWith(
      records.createdAt,
      new Date(Date.UTC(2026, 6, 1)),
    );
    expect(andMock).toHaveBeenCalled();
  });
});

describe("assertWithinSourceLimit", () => {
  it("allows a hobby user under the connected source cap", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "hobby" });
    stubSelectResult(HOBBY_CONNECTED_SOURCE_LIMIT - 1);

    await expect(assertWithinSourceLimit(USER_ID)).resolves.toBeUndefined();
  });

  it("throws a 403 ApiError when a hobby user is exactly at the connected source cap", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "hobby" });
    stubSelectResult(HOBBY_CONNECTED_SOURCE_LIMIT);

    await expect(assertWithinSourceLimit(USER_ID)).rejects.toMatchObject({
      statusCode: 403,
      errors: [
        expect.objectContaining({
          status: "403",
          detail: expect.stringContaining(String(HOBBY_CONNECTED_SOURCE_LIMIT)),
        }),
      ],
    });
  });

  it("does not cap a pro user", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "pro" });
    stubSelectResult(999);

    await expect(assertWithinSourceLimit(USER_ID)).resolves.toBeUndefined();
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("scopes the connected source count to the given user, with no month filter", async () => {
    mockFindSubscriptionByUserId.mockResolvedValue({ plan: "hobby" });
    stubSelectResult(0);

    await assertWithinSourceLimit(USER_ID);

    expect(eqMock).toHaveBeenCalledWith(sources.userId, USER_ID);
    expect(gteMock).not.toHaveBeenCalled();
  });
});
