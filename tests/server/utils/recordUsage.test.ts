import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { records } from "../../../server/db/schema";

const selectMock = vi.fn();

vi.mock("../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

// Spy-wrapped so a test can assert the exact composed where-clause — this is
// the single definition of "records this month" both the cap and the dashboard
// share (issue #130), so it must count by createdAt scoped to the user.
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

const { countRecordsCreatedThisMonth } =
  await import("../../../server/utils/recordUsage");

const USER_ID = "user_abc123";

function stubSelectResult(total: number | string | null) {
  const where = vi.fn(() => Promise.resolve([{ total }]));
  const from = vi.fn(() => ({ where }));
  selectMock.mockReturnValue({ from });
  return { from, where };
}

beforeEach(() => {
  selectMock.mockReset();
  andMock.mockClear();
  countMock.mockClear();
  eqMock.mockClear();
  gteMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("countRecordsCreatedThisMonth", () => {
  it("counts by createdAt scoped to the user and the start of the current UTC month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T15:30:00Z"));
    stubSelectResult(7);

    const total = await countRecordsCreatedThisMonth(USER_ID);

    expect(total).toBe(7);
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

  it("does not filter by syncedAt (created-this-month is what counts, not synced-this-month)", async () => {
    stubSelectResult(0);

    await countRecordsCreatedThisMonth(USER_ID);

    expect(gteMock).toHaveBeenCalledWith(records.createdAt, expect.any(Date));
    expect(gteMock).not.toHaveBeenCalledWith(
      records.syncedAt,
      expect.any(Date),
    );
  });

  it("coerces a null count from the database to 0", async () => {
    stubSelectResult(null);

    await expect(countRecordsCreatedThisMonth(USER_ID)).resolves.toBe(0);
  });

  it("coerces a string count from the database to a number", async () => {
    stubSelectResult("15");

    await expect(countRecordsCreatedThisMonth(USER_ID)).resolves.toBe(15);
  });
});
