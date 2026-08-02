import { describe, expect, it } from "vitest";
import { ApiError } from "../../../server/utils/errors";
import { hashSharedSecret } from "../../../server/utils/signatureVerifier";
import {
  computeProviderSecretPlan,
  normalizeSuppliedSecret,
  validateProviderSecretOrThrow,
} from "../../../server/utils/providerSecret";

describe("normalizeSuppliedSecret", () => {
  it.each([undefined, null])("treats %p as not supplied", (value) => {
    expect(normalizeSuppliedSecret(value)).toBeUndefined();
  });

  it("returns a supplied string unchanged", () => {
    expect(normalizeSuppliedSecret("whsec_abc")).toBe("whsec_abc");
  });

  it.each([12345, {}, [], true])("rejects a non-string (%p)", (value) => {
    expect(() => normalizeSuppliedSecret(value)).toThrow(ApiError);
  });
});

// ApiError's message is only "ApiError: <status>"; the human-readable text
// lives in errors[0].detail, so assert against that rather than the message.
function detailOfThrown(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) {
      return error.errors[0]?.detail ?? "";
    }
    throw error;
  }
  throw new Error("expected the call to throw an ApiError");
}

describe("validateProviderSecretOrThrow", () => {
  it("requires a secret for a manual-secret provider (stripe)", () => {
    expect(
      detailOfThrown(() => validateProviderSecretOrThrow("stripe", undefined)),
    ).toMatch(/required/);
  });

  it("rejects a whitespace-only secret for stripe", () => {
    expect(
      detailOfThrown(() => validateProviderSecretOrThrow("stripe", "   ")),
    ).toMatch(/required/);
  });

  it("accepts a real secret for stripe", () => {
    expect(() =>
      validateProviderSecretOrThrow("stripe", "whsec_live"),
    ).not.toThrow();
  });

  it.each(["github", "zapier", "shortcuts"])(
    "rejects a caller-supplied secret for the generated provider %s",
    (provider) => {
      expect(
        detailOfThrown(() =>
          validateProviderSecretOrThrow(provider, "user-supplied"),
        ),
      ).toMatch(/only accepted/);
    },
  );

  it.each(["github", "zapier", "shortcuts", null])(
    "accepts an omitted secret for %s",
    (provider) => {
      expect(() =>
        validateProviderSecretOrThrow(provider, undefined),
      ).not.toThrow();
    },
  );
});

describe("computeProviderSecretPlan", () => {
  it("generates a plaintext secret and reveals it for github (stored == revealed)", () => {
    const plan = computeProviderSecretPlan("github", undefined);
    expect(plan.storedSecret).toMatch(/^[0-9a-f]{48}$/);
    expect(plan.revealSecret).toBe(plan.storedSecret);
  });

  it.each(["zapier", "shortcuts"])(
    "stores the hash of the revealed plaintext for %s",
    (provider) => {
      const plan = computeProviderSecretPlan(provider, undefined);
      expect(plan.revealSecret).toMatch(/^[0-9a-f]{48}$/);
      expect(plan.storedSecret).toBe(hashSharedSecret(plan.revealSecret ?? ""));
    },
  );

  it("stores the trimmed caller secret verbatim and never reveals it for stripe", () => {
    const plan = computeProviderSecretPlan("stripe", "  whsec_x  ");
    expect(plan.storedSecret).toBe("whsec_x");
    expect(plan.revealSecret).toBeNull();
  });

  it("returns no secret for a provider it does not plan for", () => {
    expect(computeProviderSecretPlan(null, undefined)).toEqual({
      storedSecret: null,
      revealSecret: null,
    });
  });

  it("generates a different secret on each call", () => {
    const first = computeProviderSecretPlan("github", undefined);
    const second = computeProviderSecretPlan("github", undefined);
    expect(first.storedSecret).not.toBe(second.storedSecret);
  });
});
