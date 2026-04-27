import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { apiCheckAuth } from "@libs/auth";
import { ApiError } from "@libs/errors";

type ErrorBody = {
  errors: { status: string; title: string; detail: string }[];
};

const makeRequest = (authHeader?: string) =>
  new Request("https://example.com/api/resources", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
  });

const VALID_TOKEN = "test-secret-token";

beforeEach(() => {
  process.env.API_TOKEN = VALID_TOKEN;
});

afterEach(() => {
  delete process.env.API_TOKEN;
});

describe("apiCheckAuth", () => {
  it("does not throw when a valid Bearer token is provided", () => {
    const request = makeRequest(`Bearer ${VALID_TOKEN}`);
    expect(() => apiCheckAuth(request)).not.toThrow();
  });

  it("throws ApiError with 401 when no Authorization header is present", async () => {
    const request = makeRequest();

    try {
      apiCheckAuth(request);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const { response } = error as ApiError;
      expect(response.status).toBe(401);
      const body = (await response.json()) as ErrorBody;
      expect(body.data.errors[0]?.status).toBe("401");
      expect(body.data.errors[0]?.title).toBe("Unauthorized");
    }
  });

  it("throws ApiError with 401 when token is incorrect", async () => {
    const request = makeRequest("Bearer wrong-token");

    try {
      apiCheckAuth(request);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const { response } = error as ApiError;
      expect(response.status).toBe(401);
      const body = (await response.json()) as ErrorBody;
      expect(body.data.errors[0]?.detail).toBe(
        "A valid API token is required.",
      );
    }
  });

  it("throws ApiError with 401 when token is provided without Bearer prefix", () => {
    const request = makeRequest(VALID_TOKEN);
    expect(() => apiCheckAuth(request)).toThrow(ApiError);
  });
});
