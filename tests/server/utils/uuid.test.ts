import { describe, expect, it } from "vitest";
import { isValidUuid } from "../../../server/utils/uuid";

describe("isValidUuid", () => {
  it("accepts a well-formed v4 uuid", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts an uppercase uuid", () => {
    expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects a malformed uuid", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });

  it("rejects a uuid with the wrong segment lengths", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-44665544")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidUuid("")).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidUuid(undefined)).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidUuid(null)).toBe(false);
  });
});
