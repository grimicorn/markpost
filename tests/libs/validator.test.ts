import { describe, it, expect } from "vitest";
import { apiValidate } from "@libs/validator.js";
import { ApiError } from "@libs/errors.js";

type ErrorBody = {
  errors: {
    status: string;
    source: { pointer: string };
    title: string;
    detail: string;
  }[];
};

const makeBody = (attributes: object) => ({ data: { attributes } });

describe("apiValidate", () => {
  it("does not throw when all required attributes are present", () => {
    const body = makeBody({ title: "Hello", content: "World" });
    expect(() => apiValidate(body, [{ key: "title" }, { key: "content" }])).not.toThrow();
  });

  it("does not throw when no attributes are required", () => {
    const body = makeBody({});
    expect(() => apiValidate(body, [])).not.toThrow();
  });

  it("throws ApiError with 422 when a required attribute is missing", async () => {
    const body = makeBody({ content: "World" });

    try {
      apiValidate(body, [{ key: "title" }]);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const { response } = error as ApiError;
      expect(response.status).toBe(422);
      const parsed = (await response.json()) as ErrorBody;
      expect(parsed.errors[0]?.status).toBe("422");
      expect(parsed.errors[0]?.title).toBe("Invalid Attribute");
    }
  });

  it("sets source.pointer to /data/attributes/<key>", async () => {
    const body = makeBody({});

    try {
      apiValidate(body, [{ key: "title" }]);
    } catch (error) {
      const { response } = error as ApiError;
      const parsed = (await response.json()) as ErrorBody;
      expect(parsed.errors[0]?.source.pointer).toBe("/data/attributes/title");
    }
  });

  it("uses a default detail message derived from the key", async () => {
    const body = makeBody({});

    try {
      apiValidate(body, [{ key: "title" }]);
    } catch (error) {
      const { response } = error as ApiError;
      const parsed = (await response.json()) as ErrorBody;
      expect(parsed.errors[0]?.detail).toBe("Title is required");
    }
  });

  it("uses a custom message when provided", async () => {
    const body = makeBody({});

    try {
      apiValidate(body, [{ key: "title", message: "Title cannot be blank." }]);
    } catch (error) {
      const { response } = error as ApiError;
      const parsed = (await response.json()) as ErrorBody;
      expect(parsed.errors[0]?.detail).toBe("Title cannot be blank.");
    }
  });

  it("reports multiple missing attributes in a single error array", async () => {
    const body = makeBody({});

    try {
      apiValidate(body, [{ key: "title" }, { key: "content" }]);
    } catch (error) {
      const { response } = error as ApiError;
      const parsed = (await response.json()) as ErrorBody;
      expect(parsed.errors).toHaveLength(2);
      expect(parsed.errors[0]?.source.pointer).toBe("/data/attributes/title");
      expect(parsed.errors[1]?.source.pointer).toBe("/data/attributes/content");
    }
  });
});
