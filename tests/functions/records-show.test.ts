import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Context } from "@netlify/functions";
import handler from "../../../src/functions/records-show";

const VALID_TOKEN = "test-secret-token";
const MOCK_UUID = "00000000-0000-0000-0000-000000000001";
const MOCK_DATE = "2026-04-11T00:00:00.000Z";

const MOCK_RECORD = {
  uuid: MOCK_UUID,
  createdAt: MOCK_DATE,
  title: "Hello",
  content: "World",
};

vi.mock("@libs/db.js", () => ({
  getDb: () => ({
    get: vi.fn().mockResolvedValue(JSON.stringify(MOCK_RECORD)),
  }),
}));

const makeContext = (uuid: string) =>
  ({
    params: { uuid },
  }) as unknown as Context;

const makeRequest = (options: {
  method?: string;
  contentType?: string;
  auth?: string;
}) => {
  const {
    method = "GET",
    contentType = "application/vnd.api+json",
    auth = `Bearer ${VALID_TOKEN}`,
  } = options;

  return new Request(`https://example.com/api/records/${MOCK_UUID}`, {
    method,
    headers: {
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(auth ? { Authorization: auth } : {}),
    },
  });
};

type ResponseBody = {
  data?: {
    type: string;
    id: string;
    attributes: Record<string, unknown>;
    links: { self: string };
    errors?: { status: string; title: string; detail?: string; source?: { parameter: string } }[];
  };
  errors?: { status: string; title: string; detail?: string }[];
};

beforeEach(() => {
  process.env.API_TOKEN = VALID_TOKEN;
});

afterEach(() => {
  delete process.env.API_TOKEN;
});

describe("GET /api/records/:uuid", () => {
  describe("success", () => {
    it("returns 200 on a valid request", async () => {
      const response = await handler(makeRequest({}), makeContext(MOCK_UUID));
      expect(response.status).toBe(200);
    });

    it("response Content-Type is application/vnd.api+json", async () => {
      const response = await handler(makeRequest({}), makeContext(MOCK_UUID));
      expect(response.headers.get("Content-Type")).toBe(
        "application/vnd.api+json",
      );
    });

    it("response body includes the record data", async () => {
      const response = await handler(makeRequest({}), makeContext(MOCK_UUID));
      const body = (await response.json()) as ResponseBody;
      expect(body.data).toMatchObject({
        type: "records",
        id: MOCK_UUID,
        attributes: {
          uuid: MOCK_UUID,
          createdAt: MOCK_DATE,
          title: "Hello",
          content: "World",
        },
      });
    });

    it("response body includes a self link", async () => {
      const response = await handler(makeRequest({}), makeContext(MOCK_UUID));
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.links.self).toBe(`/api/records/${MOCK_UUID}`);
    });
  });

  describe("missing uuid", () => {
    it("returns 400 when uuid param is missing", async () => {
      const response = await handler(makeRequest({}), makeContext(""));
      expect(response.status).toBe(400);
    });

    it("returns 400 when uuid param is the unresolved placeholder", async () => {
      const response = await handler(makeRequest({}), makeContext(":uuid"));
      expect(response.status).toBe(400);
    });

    it("response body includes the error detail", async () => {
      const response = await handler(makeRequest({}), makeContext(""));
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.errors?.[0]).toMatchObject({
        status: "400",
        title: "Bad Request",
        detail: "Missing required path parameter: uuid",
        source: { parameter: "uuid" },
      });
    });
  });

  describe("method validation", () => {
    it("returns 405 when method is not GET", async () => {
      const response = await handler(
        makeRequest({ method: "POST" }),
        makeContext(MOCK_UUID),
      );
      expect(response.status).toBe(405);
      const body = (await response.json()) as ResponseBody;
      expect(body.errors?.[0]?.status).toBe("405");
    });
  });

  describe("authentication", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const response = await handler(
        makeRequest({ auth: "" }),
        makeContext(MOCK_UUID),
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as ResponseBody;
      expect(body.errors?.[0]?.status).toBe("401");
    });

    it("returns 401 when token is incorrect", async () => {
      const response = await handler(
        makeRequest({ auth: "Bearer wrong-token" }),
        makeContext(MOCK_UUID),
      );
      expect(response.status).toBe(401);
    });
  });
});
