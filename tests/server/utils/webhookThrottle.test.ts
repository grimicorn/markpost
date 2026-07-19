import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();

vi.mock("../../../server/db", () => ({
  getDb: () => ({ update: updateMock }),
}));

type SqlFragment = { strings: readonly string[]; values: unknown[] };

function isSqlFragment(value: unknown): value is SqlFragment {
  return (
    typeof value === "object" &&
    value !== null &&
    "strings" in value &&
    "values" in value
  );
}

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

// The real schema module is intentionally left unmocked (only `../db` and
// `drizzle-orm` are mocked above), so this is the exact same `sources` object
// instance webhookThrottle.ts builds its query against — letting the tests
// below assert by reference which column each branch reads and writes,
// rather than trying to stringify drizzle's internal column objects.
const { sources } = await import("../../../server/db/schema");

const {
  recordWebhookHit,
  WEBHOOK_THROTTLE_MAX_HITS,
  WEBHOOK_THROTTLE_WINDOW_SECONDS,
} = await import("../../../server/utils/webhookThrottle");

const SOURCE_UUID = "550e8400-e29b-41d4-a716-446655440001";

function stubUpdateReturning(rows: unknown[]) {
  const returning = vi.fn(() => Promise.resolve(rows));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  updateMock.mockReturnValue({ set });
  return { set, where, returning };
}

beforeEach(() => {
  updateMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordWebhookHit atomic update shape", () => {
  it("builds a CASE expression that resets on an expired window and otherwise increments", async () => {
    const { set } = stubUpdateReturning([
      { throttleCount: 1, throttleWindowStart: new Date() },
    ]);

    await recordWebhookHit(SOURCE_UUID);

    expect(set).toHaveBeenCalledOnce();
    const setArgument = set.mock.calls[0][0] as {
      throttleWindowStart: SqlFragment;
      throttleCount: SqlFragment;
    };

    // Literal template text is safe to assert on directly; interpolated
    // values (columns, the shared windowExpired condition) are asserted by
    // reference below rather than stringified, since drizzle column objects
    // don't stringify to anything readable.
    expect(setArgument.throttleWindowStart.strings.join("<expr>")).toBe(
      "CASE WHEN <expr> THEN now() ELSE <expr> END",
    );
    expect(setArgument.throttleCount.strings.join("<expr>")).toBe(
      "CASE WHEN <expr> THEN 1 ELSE <expr> + 1 END",
    );

    const [windowStartCondition, windowStartElseValue] =
      setArgument.throttleWindowStart.values;
    const [countCondition, countElseValue] = setArgument.throttleCount.values;

    // The ELSE branch of each CASE must read back its own column (preserve
    // the window / increment the existing count), not some other column —
    // this is what would silently break if the two branches were swapped.
    expect(windowStartElseValue).toBe(sources.throttleWindowStart);
    expect(countElseValue).toBe(sources.throttleCount);

    // Both CASE expressions must gate on the exact same shared condition,
    // so the window can never reset in one column but not the other.
    expect(isSqlFragment(windowStartCondition)).toBe(true);
    expect(windowStartCondition).toBe(countCondition);

    if (!isSqlFragment(windowStartCondition)) {
      throw new Error("expected windowExpired to be a sql fragment");
    }

    // The shared condition compares elapsed time on throttleWindowStart
    // against the configured window, not a hardcoded or inverted value.
    expect(windowStartCondition.strings.join("<expr>")).toBe(
      "(now() - <expr>) >= (<expr> * interval '1 second')",
    );
    expect(windowStartCondition.values).toEqual([
      sources.throttleWindowStart,
      WEBHOOK_THROTTLE_WINDOW_SECONDS,
    ]);
  });
});

describe("recordWebhookHit", () => {
  it("allows a hit under the limit", async () => {
    stubUpdateReturning([
      { throttleCount: 1, throttleWindowStart: new Date() },
    ]);

    const result = await recordWebhookHit(SOURCE_UUID);

    expect(result).toEqual({ allowed: true });
  });

  it("allows a hit exactly at the limit", async () => {
    stubUpdateReturning([
      {
        throttleCount: WEBHOOK_THROTTLE_MAX_HITS,
        throttleWindowStart: new Date(),
      },
    ]);

    const result = await recordWebhookHit(SOURCE_UUID);

    expect(result).toEqual({ allowed: true });
  });

  it("denies a hit over the limit and reports retryAfterSeconds", async () => {
    const windowStart = new Date(
      Date.now() - (WEBHOOK_THROTTLE_WINDOW_SECONDS - 10) * 1000,
    );
    stubUpdateReturning([
      {
        throttleCount: WEBHOOK_THROTTLE_MAX_HITS + 1,
        throttleWindowStart: windowStart,
      },
    ]);

    const result = await recordWebhookHit(SOURCE_UUID);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      // ~10 seconds remain in the window; allow slack for test execution time.
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(11);
    }
  });

  it("floors retryAfterSeconds at 1 even if the window has already elapsed", async () => {
    const windowStart = new Date(
      Date.now() - (WEBHOOK_THROTTLE_WINDOW_SECONDS + 100) * 1000,
    );
    stubUpdateReturning([
      {
        throttleCount: WEBHOOK_THROTTLE_MAX_HITS + 1,
        throttleWindowStart: windowStart,
      },
    ]);

    const result = await recordWebhookHit(SOURCE_UUID);

    expect(result).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("resets after the window: a fresh window (count 1) is allowed again", async () => {
    // First hit lands over the limit inside the old window.
    stubUpdateReturning([
      {
        throttleCount: WEBHOOK_THROTTLE_MAX_HITS + 1,
        throttleWindowStart: new Date(),
      },
    ]);
    const denied = await recordWebhookHit(SOURCE_UUID);
    expect(denied.allowed).toBe(false);

    // The DB's CASE expression resets the counter to 1 once the window has
    // expired; simulate that returned state on the next call.
    stubUpdateReturning([
      { throttleCount: 1, throttleWindowStart: new Date() },
    ]);
    const allowed = await recordWebhookHit(SOURCE_UUID);
    expect(allowed).toEqual({ allowed: true });
  });

  it("allows the hit when the source row is not found (nothing to throttle)", async () => {
    stubUpdateReturning([]);

    const result = await recordWebhookHit(SOURCE_UUID);

    expect(result).toEqual({ allowed: true });
  });
});
