import { describe, it, expect } from "vitest";
import { apiResponse } from "@libs/response";

type ResponseBody = Record<string, unknown>;

describe("apiResponse", () => {
  it("returns a Response with the given status", () => {
    const response = apiResponse({}, 200);
    expect(response.status).toBe(200);
  });

  it("always sets Content-Type to application/json", () => {
    const response = apiResponse({}, 200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("JSON-stringifies the body", async () => {
    const body = { data: { id: "1", type: "articles" } };
    const response = apiResponse(body, 200);
    const parsed = (await response.json()) as ResponseBody;
    expect(parsed).toEqual(body);
  });

  it("merges additional headers", () => {
    const response = apiResponse({}, 200, { "X-Custom": "value" });
    expect(response.headers.get("X-Custom")).toBe("value");
  });

  it("Content-Type cannot be overridden by additional headers", () => {
    const response = apiResponse({}, 200, { "Content-Type": "text/plain" });
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("works with non-200 statuses", () => {
    const response = apiResponse({}, 422);
    expect(response.status).toBe(422);
  });
});
