import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "@fns/records-index";

const VALID_TOKEN = "test-secret-token";

const MOCK_RECORDS = [
  {
    uuid: "00000000-0000-0000-0000-000000000001",
    createdAt: "2026-04-11T00:00:00.000Z",
    title: "Hello",
    content: "World",
  },
  {
    uuid: "00000000-0000-0000-0000-000000000002",
    createdAt: "2026-04-11T00:00:00.000Z",
    title: "Foo",
    content: "Bar",
  },
];

const mockList = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@libs/db.js", () => ({
  getDb: () => ({ list: mockList, get: mockGet }),
}));

const makeRequest = (options: {
  method?: string;
  auth?: string;
  search?: string;
}) => {
  const {
    method = "GET",
    auth = `Bearer ${VALID_TOKEN}`,
    search = "",
  } = options;

  return new Request(`https://example.com/api/records${search}`, {
    method,
    headers: {
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
  }[];
  meta?: { total: number; pageCount: number };
  links?: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  errors?: { status: string; title: string; detail?: string }[];
};

beforeEach(() => {
  process.env.API_TOKEN = VALID_TOKEN;
  mockList.mockResolvedValue({
    blobs: MOCK_RECORDS.map(({ uuid }) => ({ key: uuid, etag: "etag" })),
  });
  mockGet.mockImplementation((key: string) => {
    const record = MOCK_RECORDS.find((r) => r.uuid === key);
    return Promise.resolve(JSON.stringify(record));
  });
});

afterEach(() => {
  delete process.env.API_TOKEN;
});

describe("GET /api/records", () => {
  describe("success", () => {
    it("returns 200 on a valid request", async () => {
      const response = await handler(makeRequest({}));
      expect(response.status).toBe(200);
    });

    it("response Content-Type is application/json", async () => {
      const response = await handler(makeRequest({}));
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("response body includes an array of records", async () => {
      const response = await handler(makeRequest({}));
      const body = (await response.json()) as ResponseBody;
      expect(body.data).toHaveLength(MOCK_RECORDS.length);
      expect(body.data?.[0]).toMatchObject({
        type: "records",
        id: MOCK_RECORDS[0].uuid,
        attributes: MOCK_RECORDS[0],
        links: { self: `/api/records/${MOCK_RECORDS[0].uuid}` },
      });
    });

    it("response body includes meta.total", async () => {
      const response = await handler(makeRequest({}));
      const body = (await response.json()) as ResponseBody;
      expect(body.meta?.total).toBe(MOCK_RECORDS.length);
    });

    it("response body includes meta.pageCount", async () => {
      const response = await handler(makeRequest({}));
      const body = (await response.json()) as ResponseBody;
      expect(body.meta?.pageCount).toBe(1);
    });

    it("response body includes pagination links", async () => {
      const response = await handler(makeRequest({}));
      const body = (await response.json()) as ResponseBody;
      expect(body.links?.first).toBe(
        "/api/records?page[number]=1&page[size]=100",
      );
      expect(body.links?.last).toBe(
        "/api/records?page[number]=1&page[size]=100",
      );
      expect(body.links?.prev).toBeNull();
      expect(body.links?.next).toBeNull();
    });

    it("returns an empty data array when there are no records", async () => {
      mockList.mockResolvedValueOnce({ blobs: [] });
      const response = await handler(makeRequest({}));
      const body = (await response.json()) as ResponseBody;
      expect(body.data).toHaveLength(0);
      expect(body.meta?.total).toBe(0);
    });
  });

  describe("pagination", () => {
    const MANY_RECORDS = Array.from({ length: 3 }, (_, i) => ({
      uuid: `00000000-0000-0000-0000-00000000000${i + 1}`,
      createdAt: "2026-04-11T00:00:00.000Z",
      title: `Title ${i + 1}`,
      content: `Content ${i + 1}`,
    }));

    beforeEach(() => {
      mockList.mockResolvedValue({
        blobs: MANY_RECORDS.map(({ uuid }) => ({ key: uuid, etag: "etag" })),
      });
      mockGet.mockImplementation((key: string) => {
        const record = MANY_RECORDS.find((r) => r.uuid === key);
        return Promise.resolve(JSON.stringify(record));
      });
    });

    it("returns the first page of results", async () => {
      const response = await handler(
        makeRequest({ search: "?page[number]=1&page[size]=2" }),
      );
      const body = (await response.json()) as ResponseBody;
      expect(body.data).toHaveLength(2);
      expect(body.data?.[0].id).toBe(MANY_RECORDS[0].uuid);
    });

    it("returns the second page of results", async () => {
      const response = await handler(
        makeRequest({ search: "?page[number]=2&page[size]=2" }),
      );
      const body = (await response.json()) as ResponseBody;
      expect(body.data).toHaveLength(1);
      expect(body.data?.[0].id).toBe(MANY_RECORDS[2].uuid);
    });

    it("sets next link when more pages exist", async () => {
      const response = await handler(
        makeRequest({ search: "?page[number]=1&page[size]=2" }),
      );
      const body = (await response.json()) as ResponseBody;
      expect(body.links?.next).toBe("/api/records?page[number]=2&page[size]=2");
    });

    it("sets prev link when not on the first page", async () => {
      const response = await handler(
        makeRequest({ search: "?page[number]=2&page[size]=2" }),
      );
      const body = (await response.json()) as ResponseBody;
      expect(body.links?.prev).toBe("/api/records?page[number]=1&page[size]=2");
    });

    it("next is null on the last page", async () => {
      const response = await handler(
        makeRequest({ search: "?page[number]=2&page[size]=2" }),
      );
      const body = (await response.json()) as ResponseBody;
      expect(body.links?.next).toBeNull();
    });

    it("prev is null on the first page", async () => {
      const response = await handler(
        makeRequest({ search: "?page[number]=1&page[size]=2" }),
      );
      const body = (await response.json()) as ResponseBody;
      expect(body.links?.prev).toBeNull();
    });
  });

  describe("method validation", () => {
    it("returns 405 when method is not GET", async () => {
      const response = await handler(makeRequest({ method: "POST" }));
      expect(response.status).toBe(405);
      const body = (await response.json()) as ResponseBody;
      expect(body.data?.errors?.[0]?.status).toBe("405");
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
});
