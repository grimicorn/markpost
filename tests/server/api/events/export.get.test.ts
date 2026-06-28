import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const selectMock = vi.fn();

vi.mock("../../../../server/db", () => ({
  getDb: () => ({ select: selectMock }),
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
  desc: (column: unknown) => ({ desc: column }),
}));

const mockCreateError = vi.fn((options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});

const mockSetHeader = vi.fn();

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);

const handler = (await import("../../../../server/api/events/export.get"))
  .default;

const userId = "user_abc123";

function buildEvent(contextUserId: string | undefined): H3Event {
  return { context: { userId: contextUserId } } as unknown as H3Event;
}

function makeEventRow(index: number) {
  return {
    id: `id-${index}`,
    userId,
    ts: new Date(`2024-06-${String(index).padStart(2, "0")}T10:00:00Z`),
    kind: "ok",
    message: `Event ${index}`,
    recordUuid: null,
    sourceId: null,
  };
}

function stubSelectChain(rows: unknown[]) {
  const limitFn = vi.fn(() => Promise.resolve(rows));
  const orderByFn = vi.fn(() => ({ limit: limitFn }));
  const whereFn = vi.fn(() => ({ orderBy: orderByFn }));
  const fromFn = vi.fn(() => ({ where: whereFn }));
  selectMock.mockReturnValue({ from: fromFn });
}

beforeEach(() => {
  vi.stubGlobal("createError", mockCreateError);
  vi.stubGlobal("setHeader", mockSetHeader);
  mockCreateError.mockClear();
  mockSetHeader.mockClear();
  selectMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/events/export", () => {
  it("throws 401 when user is not authenticated", async () => {
    await expect(handler(buildEvent(undefined))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  });

  it("returns serialized event rows as JSON", async () => {
    const rows = [makeEventRow(3), makeEventRow(2), makeEventRow(1)];
    stubSelectChain(rows);

    const response = await handler(buildEvent(userId));

    expect(Array.isArray(response)).toBe(true);
    expect((response as unknown[]).length).toBe(3);
  });

  it("serializes ts as ISO string", async () => {
    const row = makeEventRow(1);
    stubSelectChain([row]);

    const response = (await handler(buildEvent(userId))) as Array<{
      ts: string;
    }>;

    expect(response[0].ts).toBe(row.ts.toISOString());
  });

  it("sets content-disposition attachment header", async () => {
    stubSelectChain([makeEventRow(1)]);

    await handler(buildEvent(userId));

    expect(mockSetHeader).toHaveBeenCalledWith(
      expect.anything(),
      "Content-Disposition",
      expect.stringContaining("attachment"),
    );
  });

  it("sets content-type to application/json", async () => {
    stubSelectChain([makeEventRow(1)]);

    await handler(buildEvent(userId));

    expect(mockSetHeader).toHaveBeenCalledWith(
      expect.anything(),
      "Content-Type",
      "application/json",
    );
  });

  it("includes recordUuid and sourceId in each row", async () => {
    const row = {
      id: "id-1",
      userId,
      ts: new Date("2024-06-01T10:00:00Z"),
      kind: "warn",
      message: "Conflict",
      recordUuid: "rec-abc",
      sourceId: "src-xyz",
    };
    stubSelectChain([row]);

    const response = (await handler(buildEvent(userId))) as Array<{
      recordUuid: string | null;
      sourceId: string | null;
    }>;

    expect(response[0].recordUuid).toBe("rec-abc");
    expect(response[0].sourceId).toBe("src-xyz");
  });

  it("returns empty array when no events exist", async () => {
    stubSelectChain([]);

    const response = await handler(buildEvent(userId));

    expect(response).toEqual([]);
  });

  it("sets X-Export-Truncated to false when results are within the limit", async () => {
    stubSelectChain([makeEventRow(1)]);

    await handler(buildEvent(userId));

    expect(mockSetHeader).toHaveBeenCalledWith(
      expect.anything(),
      "X-Export-Truncated",
      "false",
    );
  });
});
