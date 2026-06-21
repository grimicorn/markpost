import { describe, expect, it } from "vitest";
import { apiValidate } from "../../../server/utils/validate";
import { ApiError } from "../../../server/utils/errors";
import type { ApiRequest } from "../../../server/types/api.types";

function buildRequest(attributes: Record<string, unknown>): ApiRequest {
  return { data: { attributes } };
}

describe("apiValidate", () => {
  it("returns without throwing when all required attributes are present", () => {
    const body = buildRequest({ title: "Hello", content: "World" });

    expect(() =>
      apiValidate(body, [{ key: "title" }, { key: "content" }]),
    ).not.toThrow();
  });

  it("treats a completely absent key as a missing attribute", () => {
    const body = buildRequest({ title: "Hello" });

    expect(() =>
      apiValidate(body, [{ key: "title" }, { key: "content" }]),
    ).toThrow(ApiError);
  });

  it("throws an ApiError with status 422 when one attribute is missing", () => {
    const body = buildRequest({ title: "Hello", content: "" });

    expect(() =>
      apiValidate(body, [{ key: "title" }, { key: "content" }]),
    ).toThrow(ApiError);

    try {
      apiValidate(body, [{ key: "title" }, { key: "content" }]);
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.statusCode).toBe(422);
      expect(apiError.errors).toEqual([
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "Content is required",
          source: { pointer: "/data/attributes/content" },
        },
      ]);
    }
  });

  it("collects one error per missing attribute when multiple are missing", () => {
    const body = buildRequest({ title: "", content: null });

    try {
      apiValidate(body, [{ key: "title" }, { key: "content" }]);
      throw new Error("expected apiValidate to throw");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError.errors).toEqual([
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "Title is required",
          source: { pointer: "/data/attributes/title" },
        },
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "Content is required",
          source: { pointer: "/data/attributes/content" },
        },
      ]);
    }
  });

  it("uses a custom message when the rule provides one", () => {
    const body = buildRequest({ title: undefined });

    try {
      apiValidate(body, [{ key: "title", message: "Please provide a title." }]);
      throw new Error("expected apiValidate to throw");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.errors).toEqual([
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "Please provide a title.",
          source: { pointer: "/data/attributes/title" },
        },
      ]);
    }
  });
});
