import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const selectMock = vi.fn();
const mockFindSubscriptionByUserId = vi.fn();

vi.mock("../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ and: conditions }),
  count: (expr?: unknown) => ({ count: expr }),
  eq: (column: unknown, value: unknown) => ({ eq: { column, value } }),
  gte: (column: unknown, value: unknown) => ({ gte: { column, value } }),
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
});

afterEach(() => {
  vi.restoreAllMocks();
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
});
