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
});
