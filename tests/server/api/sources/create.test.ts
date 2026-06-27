import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const insertMock = vi.fn();

vi.mock("../../../../server/db", () => ({
  getDb: () => ({ insert: insertMock }),
}));

const mockCreateError = vi.fn((options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});

const mockReadBody = vi.fn();
const mockSetResponseStatus = vi.fn();

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);

const handler = (await import("../../../../server/api/sources/index.post"))
  .default;

const userId = "user_abc123";

const sampleSource = {
  uuid: "550e8400-e29b-41d4-a716-446655440001",
  userId,
  createdAt: new Date("2024-01-15T10:00:00Z"),
  type: "webhook",
  name: "My Webhook",
  provider: null,
  endpointSlug: "wh_8f2a91c4",
  routeFolder: "99-incoming/",
  fieldMapping: null,
  lastHitAt: null,
  recordCount: 0,
};

function buildEvent(contextUserId: string | undefined): H3Event {
  return { context: { userId: contextUserId } } as unknown as H3Event;
}

function buildBody(attributes: Record<string, unknown>) {
  return { data: { type: "sources", attributes } };
}

function stubInsertResult(rows: unknown[]) {
  const returning = vi.fn(() => Promise.resolve(rows));
  const values = vi.fn(() => ({ returning }));
  insertMock.mockReturnValue({ values });
  return { values, returning };
}

beforeEach(() => {
  vi.stubGlobal("createError", mockCreateError);
  vi.stubGlobal("readBody", mockReadBody);
  vi.stubGlobal("setResponseStatus", mockSetResponseStatus);
  mockCreateError.mockClear();
  mockReadBody.mockClear();
  mockSetResponseStatus.mockClear();
  insertMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/sources", () => {
  it("returns a 201 with the serialized source on valid input", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({
        type: "webhook",
        name: "My Webhook",
        routeFolder: "99-incoming/",
      }),
    );
    stubInsertResult([sampleSource]);

    const response = await handler(buildEvent(userId));

    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 201);
    expect(response).toEqual({
      data: {
        type: "sources",
        id: sampleSource.uuid,
        attributes: {
          uuid: sampleSource.uuid,
          userId,
          createdAt: sampleSource.createdAt,
          type: sampleSource.type,
          name: sampleSource.name,
          provider: null,
          endpointSlug: sampleSource.endpointSlug,
          routeFolder: sampleSource.routeFolder,
          fieldMapping: null,
          lastHitAt: null,
          recordCount: 0,
        },
        links: { self: `/api/sources/${sampleSource.uuid}` },
      },
    });
  });

  it("throws 422 when type is missing", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({ name: "My Webhook", routeFolder: "99-incoming/" }),
    );

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          {
            status: "422",
            title: "Invalid Attribute",
            detail: "Type is required",
            source: { pointer: "/data/attributes/type" },
          },
        ],
      },
    });
  });

  it("throws 422 when name is missing", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({ type: "webhook", routeFolder: "99-incoming/" }),
    );

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          {
            status: "422",
            title: "Invalid Attribute",
            detail: "Name is required",
            source: { pointer: "/data/attributes/name" },
          },
        ],
      },
    });
  });

  it("throws 422 when routeFolder is missing", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({ type: "webhook", name: "My Webhook" }),
    );

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          {
            status: "422",
            title: "Invalid Attribute",
            detail: "RouteFolder is required",
            source: { pointer: "/data/attributes/routeFolder" },
          },
        ],
      },
    });
  });

  it("throws 422 when type is not a recognised source type", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({
        type: "unknown-type",
        name: "My Webhook",
        routeFolder: "99-incoming/",
      }),
    );

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          {
            status: "422",
            title: "Invalid Attribute",
            detail: expect.stringContaining("Type must be one of"),
            source: { pointer: "/data/attributes/type" },
          },
        ],
      },
    });
  });

  it("accepts provider: null without throwing", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({
        type: "webhook",
        name: "My Webhook",
        routeFolder: "99-incoming/",
        provider: null,
      }),
    );
    stubInsertResult([sampleSource]);

    const response = await handler(buildEvent(userId));

    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 201);
    expect(response).toMatchObject({ data: { type: "sources" } });
  });

  it("throws 422 when provider is not a string or null", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({
        type: "webhook",
        name: "My Webhook",
        routeFolder: "99-incoming/",
        provider: 123,
      }),
    );

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 422,
      data: {
        errors: [
          {
            status: "422",
            title: "Invalid Attribute",
            detail: "Provider must be a string",
            source: { pointer: "/data/attributes/provider" },
          },
        ],
      },
    });
  });

  it("retries on a unique-slug collision and returns the source on success", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({
        type: "webhook",
        name: "My Webhook",
        routeFolder: "99-incoming/",
      }),
    );

    const uniqueViolation = Object.assign(new Error("unique"), {
      code: "23505",
    });
    const returningSuccess = vi.fn(() => Promise.resolve([sampleSource]));
    const returningFail = vi.fn(() => Promise.reject(uniqueViolation));
    const values = vi
      .fn()
      .mockReturnValueOnce({ returning: returningFail })
      .mockReturnValue({ returning: returningSuccess });
    insertMock.mockReturnValue({ values });

    const response = await handler(buildEvent(userId));

    expect(mockSetResponseStatus).toHaveBeenCalledWith(expect.anything(), 201);
    expect(response).toMatchObject({ data: { type: "sources" } });
    expect(values).toHaveBeenCalledTimes(2);
  });

  it("throws 409 after exhausting all slug-collision retries", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({
        type: "webhook",
        name: "My Webhook",
        routeFolder: "99-incoming/",
      }),
    );

    const uniqueViolation = Object.assign(new Error("unique"), {
      code: "23505",
    });
    const returning = vi.fn(() => Promise.reject(uniqueViolation));
    const values = vi.fn(() => ({ returning }));
    insertMock.mockReturnValue({ values });

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 409,
      data: { errors: expect.any(Array) },
    });
  });

  it("propagates non-unique-violation DB errors without retrying", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({
        type: "webhook",
        name: "My Webhook",
        routeFolder: "99-incoming/",
      }),
    );

    const dbError = Object.assign(new Error("connection failed"), {
      code: "08000",
    });
    const returning = vi.fn(() => Promise.reject(dbError));
    const values = vi.fn(() => ({ returning }));
    insertMock.mockReturnValue({ values });

    await expect(handler(buildEvent(userId))).rejects.toThrow();
    expect(values).toHaveBeenCalledTimes(1);
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockReadBody.mockResolvedValue(
      buildBody({
        type: "webhook",
        name: "My Webhook",
        routeFolder: "99-incoming/",
      }),
    );

    await expect(handler(buildEvent(undefined))).rejects.toThrow();
    expect(mockCreateError).toHaveBeenCalledWith({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  });
});
