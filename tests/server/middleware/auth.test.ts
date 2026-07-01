import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";
import { generateRawToken, hashToken } from "../../../server/utils/tokens";
import { stubFailingUpdate, spyConsoleError } from "../helpers";

const selectMock = vi.fn();
const updateMock = vi.fn();

vi.mock("../../../server/db", () => ({
  getDb: () => ({ select: selectMock, update: updateMock }),
}));

const mockVerifyToken = vi.fn();

vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({ verifyToken: mockVerifyToken }),
}));

const mockCreateError = vi.fn((options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});

const mockGetHeader = vi.fn();

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);

const { default: handler } = await import("../../../server/middleware/auth");

const userId = "user_abc123";
const tokenId = "token-uuid-1";

function buildEvent(path: string = "/api/records"): H3Event & {
  context: { userId?: string };
} {
  return { path, context: {} } as unknown as H3Event & {
    context: { userId?: string };
  };
}

function stubSelectResult(rows: unknown[]) {
  const limit = vi.fn(() => Promise.resolve(rows));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  selectMock.mockReturnValue({ from });
  return { from, where, limit };
}

function stubUpdateSuccess() {
  const where = vi.fn(() => Promise.resolve());
  const set = vi.fn(() => ({ where }));
  updateMock.mockReturnValue({ set });
}

beforeEach(() => {
  vi.stubGlobal("createError", mockCreateError);
  vi.stubGlobal("getHeader", mockGetHeader);
  mockCreateError.mockClear();
  mockGetHeader.mockClear();
  selectMock.mockReset();
  updateMock.mockReset();
  mockVerifyToken.mockReset();
  process.env.NUXT_CLERK_SECRET_KEY = "test_secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.NUXT_CLERK_SECRET_KEY;
});

describe("auth middleware", () => {
  describe("non-API paths", () => {
    it("skips authentication for non-API paths", async () => {
      const event = buildEvent("/some-other-path");
      await handler(event);
      expect(event.context.userId).toBeUndefined();
    });
  });

  describe("missing token", () => {
    it("throws 401 when the Authorization header is absent", async () => {
      mockGetHeader.mockReturnValue(undefined);

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    });
  });

  describe("mp_live_ API token authentication", () => {
    it("authenticates a valid mp_live_ token and sets userId", async () => {
      const rawToken = generateRawToken();

      mockGetHeader.mockReturnValue(`Bearer ${rawToken}`);
      stubSelectResult([{ id: tokenId, userId }]);
      stubUpdateSuccess();

      const event = buildEvent();
      await handler(event);

      expect(event.context.userId).toBe(userId);
    });

    it("authenticates when the Authorization header uses lowercase bearer", async () => {
      const rawToken = generateRawToken();

      mockGetHeader.mockReturnValue(`bearer ${rawToken}`);
      stubSelectResult([{ id: tokenId, userId }]);
      stubUpdateSuccess();

      const event = buildEvent();
      await handler(event);

      expect(event.context.userId).toBe(userId);
    });

    it("updates lastUsedAt when a valid token authenticates", async () => {
      const rawToken = generateRawToken();

      mockGetHeader.mockReturnValue(`Bearer ${rawToken}`);
      stubSelectResult([{ id: tokenId, userId }]);
      stubUpdateSuccess();

      await handler(buildEvent());

      expect(updateMock).toHaveBeenCalled();
    });

    it("still sets userId when the lastUsedAt update fails", async () => {
      const rawToken = generateRawToken();

      mockGetHeader.mockReturnValue(`Bearer ${rawToken}`);
      stubSelectResult([{ id: tokenId, userId }]);

      stubFailingUpdate(updateMock);
      const consoleErrorSpy = spyConsoleError();

      const event = buildEvent();
      await handler(event);

      expect(event.context.userId).toBe(userId);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("throws 401 for an unknown mp_live_ token (not in db)", async () => {
      const rawToken = generateRawToken();

      mockGetHeader.mockReturnValue(`Bearer ${rawToken}`);
      stubSelectResult([]);

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    });

    it("throws 401 for a revoked mp_live_ token", async () => {
      const rawToken = generateRawToken();

      mockGetHeader.mockReturnValue(`Bearer ${rawToken}`);
      stubSelectResult([]);

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    });

    it("does not call Clerk for mp_live_ tokens", async () => {
      const rawToken = generateRawToken();

      mockGetHeader.mockReturnValue(`Bearer ${rawToken}`);
      stubSelectResult([{ id: tokenId, userId }]);
      stubUpdateSuccess();

      await handler(buildEvent());

      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it("queries the database with an exact hash lookup, not a full table scan", async () => {
      const rawToken = generateRawToken();

      mockGetHeader.mockReturnValue(`Bearer ${rawToken}`);
      const stubs = stubSelectResult([{ id: tokenId, userId }]);
      stubUpdateSuccess();

      await handler(buildEvent());

      expect(stubs.where).toHaveBeenCalledOnce();
      expect(stubs.limit).toHaveBeenCalledWith(1);
    });
  });

  describe("Clerk JWT authentication", () => {
    it("authenticates a valid Clerk JWT and sets userId", async () => {
      const clerkToken = "eyJhbGciOiJSUzI1NiJ9.payload.signature";
      mockGetHeader.mockReturnValue(`Bearer ${clerkToken}`);
      mockVerifyToken.mockResolvedValue({ sub: userId });

      const event = buildEvent();
      await handler(event);

      expect(event.context.userId).toBe(userId);
    });

    it("throws 401 for an invalid Clerk JWT", async () => {
      const clerkToken = "eyJhbGciOiJSUzI1NiJ9.payload.signature";
      mockGetHeader.mockReturnValue(`Bearer ${clerkToken}`);
      mockVerifyToken.mockRejectedValue(new Error("Invalid token"));

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    });

    it("does not query the database for Clerk JWTs", async () => {
      const clerkToken = "eyJhbGciOiJSUzI1NiJ9.payload.signature";
      mockGetHeader.mockReturnValue(`Bearer ${clerkToken}`);
      mockVerifyToken.mockResolvedValue({ sub: userId });

      await handler(buildEvent());

      expect(selectMock).not.toHaveBeenCalled();
    });
  });
});
