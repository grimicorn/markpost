import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "@fns/records-create";

const VALID_TOKEN = "test-secret-token";
const MOCK_UUID = "00000000-0000-0000-0000-000000000001";
const MOCK_DATE = "2026-04-11T00:00:00.000Z";

vi.mock("uuid", () => ({ v4: () => MOCK_UUID }));
vi.mock("@libs/db.js", () => ({
  getDb: () => ({ setJSON: vi.fn().mockResolvedValue({}) }),
}));

const makeRequest = (options: {
  method?: string;
  contentType?: string;
  auth?: string;
  body?: object;
}) => {
  const {
    method = "POST",
    contentType = "application/vnd.api+json",
    auth = `Bearer ${VALID_TOKEN}`,
    body = { data: { attributes: { title: "Hello", content: "World" } } },
  } = options;

  return new Request("https://example.com/api/records", {
    method,
    headers: {
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(auth ? { Authorization: auth } : {}),
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });
};

type ResponseBody = {
  data?: {
    type: string;
    id: string;
    attributes: Record<string, unknown>;
    links: { self: string };
  };
  errors?: { status: string; title: string; detail?: string }[];
};

beforeEach(() => {
  process.env.API_TOKEN = VALID_TOKEN;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(MOCK_DATE));
});

afterEach(() => {
  delete process.env.API_TOKEN;
  vi.useRealTimers();
});

describe("POST /api/records", () => {
  describe("success", () => {
    it("returns 201 on a valid request", async () => {
      const response = await handler(makeRequest({}));
      expect(response.status).toBe(201);
    });

    it("response Content-Type is application/vnd.api+json", async () => {
      const response = await handler(makeRequest({}));
      expect(response.headers.get("Content-Type")).toBe(
        "application/vnd.api+json",
      );
    });

    it("response body includes the record data", async () => {
      const response = await handler(makeRequest({}));
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
      const response = await handler(makeRequest({}));
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.links.self).toBe(`/api/records/${MOCK_UUID}`);
    });
  });

  describe("method validation", () => {
    it("returns 405 when method is not POST", async () => {
      const response = await handler(makeRequest({ method: "GET" }));
      expect(response.status).toBe(405);
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.errors?.[0]?.status).toBe("405");
    });
  });

  describe("Content-Type validation", () => {
    it("returns 415 when Content-Type is missing", async () => {
      const response = await handler(makeRequest({ contentType: "" }));
      expect(response.status).toBe(415);
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.errors?.[0]?.status).toBe("415");
    });

    it("returns 415 when Content-Type is application/json", async () => {
      const response = await handler(
        makeRequest({ contentType: "application/json" }),
      );
      expect(response.status).toBe(415);
    });
  });

  describe("authentication", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const response = await handler(makeRequest({ auth: "" }));
      expect(response.status).toBe(401);
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.errors?.[0]?.status).toBe("401");
    });

    it("returns 401 when token is incorrect", async () => {
      const response = await handler(
        makeRequest({ auth: "Bearer wrong-token" }),
      );
      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("returns 422 when title is missing", async () => {
      const response = await handler(
        makeRequest({ body: { data: { attributes: { content: "World" } } } }),
      );
      expect(response.status).toBe(422);
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.errors?.[0]?.status).toBe("422");
      expect(body.data?.errors?.[0]?.title).toBe("Invalid Attribute");
    });

    it("returns 422 when content is missing", async () => {
      const response = await handler(
        makeRequest({ body: { data: { attributes: { title: "Hello" } } } }),
      );
      expect(response.status).toBe(422);
    });

    it("returns 422 with both errors when title and content are missing", async () => {
      const response = await handler(
        makeRequest({ body: { data: { attributes: {} } } }),
      );
      expect(response.status).toBe(422);
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.errors).toHaveLength(2);
    });
  });
});
