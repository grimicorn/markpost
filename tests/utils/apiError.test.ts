import { describe, it, expect } from "vitest";
import { extractErrorDetail } from "../../app/utils/apiError";

describe("extractErrorDetail", () => {
  it("returns the detail from a JSON:API error body", () => {
    const error = { data: { errors: [{ detail: "Session expired." }] } };
    expect(extractErrorDetail(error, "fallback")).toBe("Session expired.");
  });

  it("returns the fallback when the error has no data", () => {
    expect(extractErrorDetail(new Error("network error"), "fallback")).toBe(
      "fallback",
    );
  });

  it("returns the fallback when errors is an empty array", () => {
    const error = { data: { errors: [] } };
    expect(extractErrorDetail(error, "fallback")).toBe("fallback");
  });

  it("returns the fallback for a null or undefined error", () => {
    expect(extractErrorDetail(null, "fallback")).toBe("fallback");
    expect(extractErrorDetail(undefined, "fallback")).toBe("fallback");
  });

  it("uses only the first error's detail when multiple are present", () => {
    const error = {
      data: { errors: [{ detail: "First." }, { detail: "Second." }] },
    };
    expect(extractErrorDetail(error, "fallback")).toBe("First.");
  });
});
