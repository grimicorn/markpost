import { describe, it, expect, vi, beforeEach } from "vitest";
import type { H3Event } from "h3";

// ── DB mock: capture per-table where calls ────────────────────────────────

const recordsWhere = vi.fn().mockResolvedValue([]);
const sourcesWhere = vi.fn().mockResolvedValue([]);
const userSettingsWhere = vi.fn().mockResolvedValue([]);

const mockTransaction = {
  delete: vi.fn(),
};

type TransactionCallback = (
  transaction: typeof mockTransaction,
) => Promise<void>;

const mockDb = {
  transaction: vi.fn(async (callback: TransactionCallback) => {
    await callback(mockTransaction);
  }),
};

vi.mock("../../../../server/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("../../../../server/db/schema", () => ({
  records: "records_table",
  sources: "sources_table",
  userSettings: "user_settings_table",
}));

vi.mock("drizzle-orm", () => ({
  eq: (field: unknown, value: unknown) => ({ field, value }),
}));

// ── H3 globals ────────────────────────────────────────────────────────────

const mockCreateError = vi.fn((options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);
vi.stubGlobal("createError", mockCreateError);

// ── Import AFTER mocks ────────────────────────────────────────────────────

const { default: handler } =
  await import("../../../../server/api/account/index.delete");

// ── Helpers ───────────────────────────────────────────────────────────────

function buildEvent(userId: string | undefined): H3Event {
  return { context: { userId } } as unknown as H3Event;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateError.mockImplementation((options: object) => {
      const error = new Error("createError");
      Object.assign(error, options);
      return error;
    });
    mockTransaction.delete.mockImplementation((table: string) => {
      if (table === "records_table") {
        return { where: recordsWhere };
      }
      if (table === "sources_table") {
        return { where: sourcesWhere };
      }
      return { where: userSettingsWhere };
    });
  });

  it("throws 401 when the request is unauthenticated", async () => {
    const event = buildEvent(undefined);
    await expect(handler(event)).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it("wraps all deletes in a single transaction", async () => {
    const event = buildEvent("user_123");
    await handler(event);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes records scoped to the authenticated userId", async () => {
    await handler(buildEvent("user_123"));
    expect(recordsWhere).toHaveBeenCalledWith(
      expect.objectContaining({ value: "user_123" }),
    );
  });

  it("deletes sources scoped to the authenticated userId", async () => {
    await handler(buildEvent("user_123"));
    expect(sourcesWhere).toHaveBeenCalledWith(
      expect.objectContaining({ value: "user_123" }),
    );
  });

  it("deletes userSettings scoped to the authenticated userId", async () => {
    await handler(buildEvent("user_123"));
    expect(userSettingsWhere).toHaveBeenCalledWith(
      expect.objectContaining({ value: "user_123" }),
    );
  });

  it("returns { meta: { deleted: true } } on success", async () => {
    const event = buildEvent("user_123");
    const result = await handler(event);
    expect(result).toEqual({ meta: { deleted: true } });
  });

  it("propagates errors through apiErrorHandler when the transaction throws", async () => {
    mockDb.transaction.mockRejectedValueOnce(new Error("db error"));
    const event = buildEvent("user_123");
    await expect(handler(event)).rejects.toThrow();
  });
});
