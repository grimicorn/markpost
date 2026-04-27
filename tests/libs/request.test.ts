import { describe, it, expect } from "vitest";
import { apiValidateRequest } from "@libs/request";
import { ApiError } from "@libs/errors";

type ApiErrorBody = {
  errors: {
    status: number;
    title: string;
    detail: string;
  }[];
};

const makeRequest = (method: string, contentType?: string) =>
  new Request("https://example.com/api/resources", {
    method,
    headers: contentType ? { "Content-Type": contentType } : {},
  });

describe("apiValidateRequest", () => {
  describe("method validation", () => {
    it("does not throw when method matches", () => {
      const request = makeRequest("POST", "application/vnd.api+json");
      expect(() => apiValidateRequest(request, "POST")).not.toThrow();
    });

    it("is case-insensitive for method comparison", () => {
      const request = makeRequest("POST", "application/vnd.api+json");
      expect(() => apiValidateRequest(request, "post")).not.toThrow();
    });

    it("throws ApiError with 405 when method does not match", async () => {
      const request = makeRequest("GET", "application/vnd.api+json");
      expect(() => apiValidateRequest(request, "POST")).toThrow(ApiError);

      try {
        apiValidateRequest(request, "POST");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const { response } = error as ApiError;
        expect(response.status).toBe(405);
        const body = (await response.json()) as ApiErrorBody;
        expect(body.data.errors[0]?.status).toBe("405");
        expect(body.data.errors[0]?.title).toBe("Method Not Allowed");
        expect(body.data.errors[0]?.detail).toContain("GET");
      }
    });
  });

  describe("Content-Type validation", () => {
    it("does not throw for exact application/vnd.api+json", () => {
      const request = makeRequest("POST", "application/vnd.api+json");
      expect(() => apiValidateRequest(request, "POST")).not.toThrow();
    });

    it("does not throw when Content-Type includes charset suffix", () => {
      const request = makeRequest(
        "POST",
        "application/vnd.api+json; charset=utf-8",
      );
      expect(() => apiValidateRequest(request, "POST")).not.toThrow();
    });

    it("throws ApiError with 415 when Content-Type is missing", async () => {
      const request = makeRequest("POST");

      try {
        apiValidateRequest(request, "POST");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const { response } = error as ApiError;
        expect(response.status).toBe(415);
        const body = (await response.json()) as ApiErrorBody;
        expect(body.data.errors[0]?.status).toBe("415");
        expect(body.data.errors[0]?.title).toBe("Unsupported Media Type");
      }
    });

    it("throws ApiError with 415 when Content-Type is application/json", async () => {
      const request = makeRequest("POST", "application/json");

      try {
        apiValidateRequest(request, "POST");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const { response } = error as ApiError;
        expect(response.status).toBe(415);
        const body = (await response.json()) as ApiErrorBody;
        expect(body.data.errors[0]?.status).toBe("415");
        expect(body.data.errors[0]?.detail).toBe(
          "Content-Type must be application/vnd.api+json",
        );
      }
    });
  });
});
