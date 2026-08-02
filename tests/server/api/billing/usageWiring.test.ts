import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

// Isolated from usage.test.ts because this suite mocks the shared count function
// itself. It guards the exact invariant behind issue #130: the dashboard must
// source its monthly record number from countRecordsCreatedThisMonth (the same
// function assertWithinRecordLimit enforces), never a local reimplementation.
const SHARED_COUNT_SENTINEL = 4242;
const countRecordsCreatedThisMonthMock = vi
  .fn()
  .mockResolvedValue(SHARED_COUNT_SENTINEL);
const selectMock = vi.fn();
const mockFindSubscriptionByUserId = vi.fn();

vi.mock("../../../../server/utils/recordUsage", () => ({
  countRecordsCreatedThisMonth: (userId: string) =>
    countRecordsCreatedThisMonthMock(userId),
}));

vi.mock("../../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  count: (expr?: unknown) => ({ count: expr }),
  eq: (column: unknown, value: unknown) => ({ eq: { column, value } }),
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

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);
vi.stubGlobal("createError", (options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});
vi.stubGlobal("requireUser", (event: H3Event) => {
  const contextUserId = (event.context as { userId?: string }).userId;
  if (!contextUserId) {
    throw new Error("Unauthorized");
  }
  return contextUserId;
});

const handler = (await import("../../../../server/api/billing/usage.get"))
  .default;

const USER_ID = "user_abc123";

function buildEvent(): H3Event {
  return { context: { userId: USER_ID } } as unknown as H3Event;
}

beforeEach(() => {
  countRecordsCreatedThisMonthMock.mockClear();
  countRecordsCreatedThisMonthMock.mockResolvedValue(SHARED_COUNT_SENTINEL);
  mockFindSubscriptionByUserId.mockReset();
  mockFindSubscriptionByUserId.mockResolvedValue(null);
  const where = vi.fn(() => Promise.resolve([{ total: 0 }]));
  const from = vi.fn(() => ({ where }));
  selectMock.mockReturnValue({ from });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/billing/usage wiring", () => {
  it("reports the count from the shared countRecordsCreatedThisMonth, not a local query", async () => {
    const response = await handler(buildEvent());

    expect(countRecordsCreatedThisMonthMock).toHaveBeenCalledWith(USER_ID);
    expect(response.data.recordsCreatedThisMonth).toBe(SHARED_COUNT_SENTINEL);
  });
});
