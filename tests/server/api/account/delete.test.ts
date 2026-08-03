import { describe, it, expect, vi, beforeEach } from "vitest";
import type { H3Event } from "h3";
import { createMockCreateError } from "../../helpers";

// ── DB mock: capture the users delete ─────────────────────────────────────

const usersWhere = vi.fn().mockResolvedValue([]);
const deleteMock = vi.fn(() => ({ where: usersWhere }));

const mockDb = {
  delete: deleteMock,
};

vi.mock("../../../../server/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("../../../../server/db/schema", () => ({
  users: "users_table",
}));

vi.mock("drizzle-orm", () => ({
  eq: (field: unknown, value: unknown) => ({ field, value }),
}));

const mockDeleteClerkUser = vi.fn();

vi.mock("../../../../server/utils/clerk", () => ({
  deleteClerkUser: mockDeleteClerkUser,
}));

const mockFindSubscriptionByUserId = vi.fn();

vi.mock("../../../../server/utils/billing", () => ({
  findSubscriptionByUserId: (...args: unknown[]) =>
    mockFindSubscriptionByUserId(...args),
}));

const mockCancelSubscription = vi.fn();

vi.mock("../../../../server/services/stripe", () => ({
  cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
}));

// ── H3 globals ────────────────────────────────────────────────────────────

const mockCreateError = createMockCreateError();

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
    usersWhere.mockResolvedValue([]);
    deleteMock.mockImplementation(() => ({ where: usersWhere }));
    mockDeleteClerkUser.mockResolvedValue(undefined);
    mockFindSubscriptionByUserId.mockResolvedValue(null);
    mockCancelSubscription.mockResolvedValue(undefined);
  });

  it("throws 401 when the request is unauthenticated", async () => {
    const event = buildEvent(undefined);
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
    expect(mockCreateError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it("deletes the users row so every user-owned table cascades", async () => {
    await handler(buildEvent("user_123"));
    expect(deleteMock).toHaveBeenCalledWith("users_table");
  });

  it("scopes the delete to the authenticated userId", async () => {
    await handler(buildEvent("user_123"));
    expect(usersWhere).toHaveBeenCalledWith(
      expect.objectContaining({ value: "user_123" }),
    );
  });

  it("deletes the Clerk user for the authenticated userId", async () => {
    await handler(buildEvent("user_123"));
    expect(mockDeleteClerkUser).toHaveBeenCalledWith("user_123");
  });

  it("wipes app data before deleting the Clerk identity", async () => {
    await handler(buildEvent("user_123"));
    expect(usersWhere.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteClerkUser.mock.invocationCallOrder[0],
    );
  });

  it("returns { meta: { deleted: true } } on success", async () => {
    const result = await handler(buildEvent("user_123"));
    expect(result).toEqual({ meta: { deleted: true } });
  });

  it("propagates errors through apiErrorHandler when the db delete throws", async () => {
    usersWhere.mockRejectedValueOnce(new Error("db error"));
    await expect(handler(buildEvent("user_123"))).rejects.toThrow();
    expect(mockDeleteClerkUser).not.toHaveBeenCalled();
  });

  it("propagates errors through apiErrorHandler when Clerk deletion throws", async () => {
    mockDeleteClerkUser.mockRejectedValueOnce(new Error("clerk error"));
    await expect(handler(buildEvent("user_123"))).rejects.toThrow();
  });

  it("cancels the live Stripe subscription before wiping local data", async () => {
    mockFindSubscriptionByUserId.mockResolvedValueOnce({
      status: "active",
      stripeSubscriptionId: "sub_live_1",
    });

    await handler(buildEvent("user_123"));

    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_live_1");
    expect(mockCancelSubscription.mock.invocationCallOrder[0]).toBeLessThan(
      usersWhere.mock.invocationCallOrder[0],
    );
  });

  it("skips Stripe when the user has no subscription row", async () => {
    mockFindSubscriptionByUserId.mockResolvedValueOnce(null);

    await handler(buildEvent("user_123"));

    expect(mockCancelSubscription).not.toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith("users_table");
  });

  it("skips Stripe when the subscription has no Stripe subscription id", async () => {
    mockFindSubscriptionByUserId.mockResolvedValueOnce({
      status: "active",
      stripeSubscriptionId: null,
    });

    await handler(buildEvent("user_123"));

    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it("delegates the terminal-status decision to the Stripe service (calls it even for a locally-canceled row)", async () => {
    mockFindSubscriptionByUserId.mockResolvedValueOnce({
      status: "canceled",
      stripeSubscriptionId: "sub_dead_1",
    });

    await handler(buildEvent("user_123"));

    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_dead_1");
  });

  it("aborts the delete with a 503 (fail closed) when Stripe cancellation genuinely fails", async () => {
    mockFindSubscriptionByUserId.mockResolvedValueOnce({
      status: "active",
      stripeSubscriptionId: "sub_live_1",
    });
    mockCancelSubscription.mockRejectedValueOnce(new Error("stripe down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(handler(buildEvent("user_123"))).rejects.toMatchObject({
      statusCode: 503,
      data: {
        errors: [
          expect.objectContaining({
            status: "503",
            detail: expect.stringContaining("was not deleted"),
          }),
        ],
      },
    });
    expect(deleteMock).not.toHaveBeenCalled();
    expect(mockDeleteClerkUser).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("logs for manual reconciliation when the DB delete fails after a successful cancel", async () => {
    mockFindSubscriptionByUserId.mockResolvedValueOnce({
      status: "active",
      stripeSubscriptionId: "sub_live_1",
    });
    usersWhere.mockRejectedValueOnce(new Error("db error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(handler(buildEvent("user_123"))).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("reconcile manually"),
      expect.objectContaining({ canceledSubscriptionId: "sub_live_1" }),
    );
    errorSpy.mockRestore();
  });

  it("logs for manual reconciliation when Clerk deletion fails after a successful cancel", async () => {
    mockFindSubscriptionByUserId.mockResolvedValueOnce({
      status: "active",
      stripeSubscriptionId: "sub_live_1",
    });
    mockDeleteClerkUser.mockRejectedValueOnce(new Error("clerk error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(handler(buildEvent("user_123"))).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("reconcile manually"),
      expect.objectContaining({ canceledSubscriptionId: "sub_live_1" }),
    );
    errorSpy.mockRestore();
  });
});
