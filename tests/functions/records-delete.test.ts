import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "@fns/records-delete";

const VALID_TOKEN = "test-secret-token";
const MOCK_UUIDS = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
];

const mockDelete = vi.fn().mockResolvedValue(undefined);

vi.mock("@libs/db.js", () => ({
  getDb: () => ({ delete: mockDelete }),
}));

const makeRequest = (options: {
  method?: string;
  contentType?: string;
  auth?: string;
  body?: object;
}) => {
  const {
    method = "DELETE",
    contentType = "application/json",
    auth = `Bearer ${VALID_TOKEN}`,
    body = { data: { attributes: { uuids: MOCK_UUIDS } } },
  } = options;

  return new Request("https://example.com/api/records", {
    method,
    headers: {
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
};

type ResponseBody = {
  meta?: { deleted: number };
  errors?: { status: string; title: string; detail?: string }[];
};

beforeEach(() => {
  process.env.API_TOKEN = VALID_TOKEN;
  mockDelete.mockClear();
});

afterEach(() => {
  delete process.env.API_TOKEN;
});

describe("DELETE /api/records", () => {
  describe("success", () => {
    it("returns 200 on a valid request", async () => {
      const response = await handler(makeRequest({}));
      expect(response.status).toBe(200);
    });

    it("response Content-Type is application/json", async () => {
      const response = await handler(makeRequest({}));
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("response body includes meta.deleted count", async () => {
      const response = await handler(makeRequest({}));
      const body = (await response.json()) as ResponseBody;
      expect(body.meta?.deleted).toBe(MOCK_UUIDS.length);
    });

    it("calls delete for each uuid", async () => {
      await handler(makeRequest({}));
      expect(mockDelete).toHaveBeenCalledTimes(MOCK_UUIDS.length);
      MOCK_UUIDS.forEach((uuid) => {
        expect(mockDelete).toHaveBeenCalledWith(uuid);
      });
    });
  });

  describe("method validation", () => {
    it("returns 405 when method is not DELETE", async () => {
      const response = await handler(makeRequest({ method: "POST" }));
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

    it("returns 415 when Content-Type is text/html", async () => {
      const response = await handler(makeRequest({ contentType: "text/html" }));
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
    it("returns 422 when uuids is missing", async () => {
      const response = await handler(
        makeRequest({ body: { data: { attributes: {} } } }),
      );
      expect(response.status).toBe(422);
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.errors?.[0]?.status).toBe("422");
      expect(body.data?.errors?.[0]?.title).toBe("Invalid Attribute");
    });
  });
});
