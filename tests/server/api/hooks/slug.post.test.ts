import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();

vi.mock("../../../../server/db", () => ({
  getDb: () => ({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

const mockCreateError = vi.fn((options: object) => {
  const error = new Error("createError");
  Object.assign(error, options);
  return error;
});

const mockReadRawBody = vi.fn();
const mockGetHeader = vi.fn();
const mockGetRouterParam = vi.fn();
const mockSetResponseStatus = vi.fn();

vi.stubGlobal("defineEventHandler", (fn: unknown) => fn);

const handler = (await import("../../../../server/api/hooks/[slug].post"))
  .default;

const SOURCE_UUID = "550e8400-e29b-41d4-a716-446655440001";
const USER_ID = "user_abc123";
const SOURCE_NAME = "My Webhook";
const STRIPE_SECRET = "whsec_test_stripe_secret";
const DEFAULT_FILENAME_TEMPLATE = "{{date}}-{{slug}}.md";

const sampleSource = {
  uuid: SOURCE_UUID,
  userId: USER_ID,
  type: "webhook",
  name: SOURCE_NAME,
  provider: null,
  fieldMapping: null,
};

const sampleRecord = {
  uuid: "550e8400-e29b-41d4-a716-446655440002",
  createdAt: new Date("2024-01-15T10:00:00Z"),
  userId: USER_ID,
  title: "Untitled",
  content: "",
  sourceId: SOURCE_UUID,
  source: SOURCE_NAME,
  status: "pending",
  filePath: null,
  tags: [],
  frontmatter: null,
  syncedAt: null,
  errorMessage: null,
};

function buildEvent(): H3Event {
  return { context: {} } as unknown as H3Event;
}

function makeSelectChain(resolvedRows: unknown[]) {
  const limit = vi.fn(() => Promise.resolve(resolvedRows));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from, where, limit };
}

function stubSourceAndSettings(
  sourceRows: unknown[],
  filenameTemplate = DEFAULT_FILENAME_TEMPLATE,
) {
  const sourceChain = makeSelectChain(sourceRows);
  const settingsChain = makeSelectChain([{ filenameTemplate }]);

  selectMock
    .mockReturnValueOnce({ from: sourceChain.from })
    .mockReturnValueOnce({ from: settingsChain.from });

  return { sourceChain, settingsChain };
}

function stubSourceOnly(sourceRows: unknown[]) {
  const sourceChain = makeSelectChain(sourceRows);
  selectMock.mockReturnValueOnce({ from: sourceChain.from });
  return sourceChain;
}

function stubInsertRecord(row: unknown) {
  const returning = vi.fn(() => Promise.resolve([row]));
  const values = vi.fn(() => ({ returning }));
  insertMock.mockReturnValue({ values });
  return { values, returning };
}

function stubUpdateStats() {
  const where = vi.fn(() => Promise.resolve());
  const set = vi.fn(() => ({ where }));
  updateMock.mockReturnValue({ set });
  return { set, where };
}

function buildValidStripeHeader(rawBody: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${rawBody}`;
  const sig = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  return `t=${ts},v1=${sig}`;
}

beforeEach(() => {
  vi.stubGlobal("createError", mockCreateError);
  vi.stubGlobal("readRawBody", mockReadRawBody);
  vi.stubGlobal("getHeader", mockGetHeader);
  vi.stubGlobal("getRouterParam", mockGetRouterParam);
  vi.stubGlobal("setResponseStatus", mockSetResponseStatus);

  mockCreateError.mockClear();
  mockReadRawBody.mockClear();
  mockGetHeader.mockClear();
  mockGetRouterParam.mockClear();
  mockSetResponseStatus.mockClear();

  selectMock.mockReset();
  insertMock.mockReset();
  updateMock.mockReset();

  mockGetRouterParam.mockReturnValue("wh_abc12345");
  mockGetHeader.mockReturnValue(undefined);
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/hooks/[slug]", () => {
  describe("unknown slug", () => {
    it("returns 404 when no source matches the slug", async () => {
      stubSourceOnly([]);
      mockReadRawBody.mockResolvedValue(JSON.stringify({ title: "T" }));

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith({
        statusCode: 404,
        data: {
          errors: [
            {
              status: "404",
              title: "Not Found",
              detail: "No source was found for the given slug.",
            },
          ],
        },
      });
    });

    it("returns 404 when the slug router param is missing", async () => {
      mockGetRouterParam.mockReturnValue(undefined);
      mockReadRawBody.mockResolvedValue("");

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });

  describe("valid payload — non-stripe source", () => {
    it("ingests a payload and returns 202 with record uuid", async () => {
      const rawBody = JSON.stringify({
        title: "Deploy succeeded",
        content: "Build #42 passed",
      });

      stubSourceAndSettings([sampleSource]);
      stubInsertRecord({ ...sampleRecord, title: "Deploy succeeded" });
      stubUpdateStats();
      mockReadRawBody.mockResolvedValue(rawBody);

      const response = await handler(buildEvent());

      expect(mockSetResponseStatus).toHaveBeenCalledWith(
        expect.anything(),
        202,
      );
      expect(response).toMatchObject({ data: { uuid: sampleRecord.uuid } });
    });

    it("inserts a record with correct sourceId and userId", async () => {
      const rawBody = JSON.stringify({ title: "T", content: "C" });

      stubSourceAndSettings([sampleSource]);
      const { values } = stubInsertRecord(sampleRecord);
      stubUpdateStats();
      mockReadRawBody.mockResolvedValue(rawBody);

      await handler(buildEvent());

      const insertedValues = (
        values.mock.calls[0] as [Record<string, unknown>]
      )[0];

      expect(insertedValues.userId).toBe(USER_ID);
      expect(insertedValues.sourceId).toBe(SOURCE_UUID);
      expect(insertedValues.status).toBe("pending");
    });

    it("handles a non-JSON body without crashing", async () => {
      stubSourceAndSettings([sampleSource]);
      stubInsertRecord(sampleRecord);
      stubUpdateStats();
      mockReadRawBody.mockResolvedValue("not-json");

      const response = await handler(buildEvent());

      expect(mockSetResponseStatus).toHaveBeenCalledWith(
        expect.anything(),
        202,
      );
      expect(response).toMatchObject({ data: { uuid: sampleRecord.uuid } });
    });

    it("handles a valid-JSON non-object body (null) without crashing", async () => {
      stubSourceAndSettings([sampleSource]);
      stubInsertRecord(sampleRecord);
      stubUpdateStats();
      mockReadRawBody.mockResolvedValue("null");

      const response = await handler(buildEvent());

      expect(mockSetResponseStatus).toHaveBeenCalledWith(
        expect.anything(),
        202,
      );
      expect(response).toMatchObject({ data: { uuid: sampleRecord.uuid } });
    });

    it("handles a valid-JSON array body without crashing", async () => {
      stubSourceAndSettings([sampleSource]);
      stubInsertRecord(sampleRecord);
      stubUpdateStats();
      mockReadRawBody.mockResolvedValue(JSON.stringify([1, 2, 3]));

      const response = await handler(buildEvent());

      expect(mockSetResponseStatus).toHaveBeenCalledWith(
        expect.anything(),
        202,
      );
      expect(response).toMatchObject({ data: { uuid: sampleRecord.uuid } });
    });
  });

  describe("stripe signature verification", () => {
    const stripeSource = { ...sampleSource, provider: "stripe" };

    it("returns 401 when Stripe-Signature header is missing", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;

      stubSourceOnly([stripeSource]);
      mockReadRawBody.mockResolvedValue(
        JSON.stringify({ type: "charge.succeeded" }),
      );
      mockGetHeader.mockReturnValue(undefined);

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 }),
      );
    });

    it("returns 401 when Stripe-Signature does not match", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
      const rawBody = JSON.stringify({ type: "charge.succeeded" });

      stubSourceOnly([stripeSource]);
      mockReadRawBody.mockResolvedValue(rawBody);
      mockGetHeader.mockReturnValue(
        buildValidStripeHeader(rawBody, "wrong_secret"),
      );

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 }),
      );
    });

    it("returns 202 when Stripe-Signature is valid", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
      const rawBody = JSON.stringify({ type: "charge.succeeded" });
      const validHeader = buildValidStripeHeader(rawBody, STRIPE_SECRET);

      stubSourceAndSettings([stripeSource]);
      stubInsertRecord(sampleRecord);
      stubUpdateStats();
      mockReadRawBody.mockResolvedValue(rawBody);
      mockGetHeader.mockReturnValue(validHeader);

      const response = await handler(buildEvent());

      expect(mockSetResponseStatus).toHaveBeenCalledWith(
        expect.anything(),
        202,
      );
      expect(response).toMatchObject({ data: { uuid: sampleRecord.uuid } });
    });

    it("returns 401 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const rawBody = JSON.stringify({ type: "charge.succeeded" });

      stubSourceOnly([stripeSource]);
      mockReadRawBody.mockResolvedValue(rawBody);
      mockGetHeader.mockReturnValue("t=1,v1=abc");

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 }),
      );
    });
  });

  describe("fieldMapping", () => {
    it("applies stored fieldMapping to map nested payload fields", async () => {
      const mappedSource = {
        ...sampleSource,
        fieldMapping: { title: "event.name", content: "event.body" },
      };
      const rawBody = JSON.stringify({
        event: { name: "Deployment done", body: "All green" },
      });

      stubSourceAndSettings([mappedSource]);
      const { values } = stubInsertRecord(sampleRecord);
      stubUpdateStats();
      mockReadRawBody.mockResolvedValue(rawBody);

      await handler(buildEvent());

      const insertedValues = (
        values.mock.calls[0] as [Record<string, unknown>]
      )[0];
      expect(insertedValues.title).toBe("Deployment done");
      expect(insertedValues.content).toBe("All green");
    });
  });

  describe("insert failure", () => {
    it("throws 500 when the DB insert returns no row", async () => {
      const rawBody = JSON.stringify({ title: "T", content: "C" });

      stubSourceAndSettings([sampleSource]);

      const returning = vi.fn(() => Promise.resolve([]));
      const values = vi.fn(() => ({ returning }));
      insertMock.mockReturnValue({ values });

      stubUpdateStats();
      mockReadRawBody.mockResolvedValue(rawBody);

      await expect(handler(buildEvent())).rejects.toThrow();
      expect(mockCreateError).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 500 }),
      );
    });
  });

  describe("source stats update", () => {
    it("does not throw when updateSourceStats fails", async () => {
      const rawBody = JSON.stringify({ title: "T", content: "C" });

      stubSourceAndSettings([sampleSource]);
      stubInsertRecord(sampleRecord);

      const where = vi.fn(() => Promise.reject(new Error("db error")));
      const set = vi.fn(() => ({ where }));
      updateMock.mockReturnValue({ set });

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockReadRawBody.mockResolvedValue(rawBody);

      const response = await handler(buildEvent());

      expect(mockSetResponseStatus).toHaveBeenCalledWith(
        expect.anything(),
        202,
      );
      expect(response).toMatchObject({ data: { uuid: sampleRecord.uuid } });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[hooks/ingest]"),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
