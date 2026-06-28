import { createHmac } from "node:crypto";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseStripeSignatureHeader,
  verifyStripeSignature,
  verifyProviderSignature,
} from "../../../server/utils/signatureVerifier";

afterEach(() => {
  vi.restoreAllMocks();
});

function buildValidStripeHeader(
  rawBody: string,
  secret: string,
  timestamp?: number,
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${rawBody}`;
  const sig = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  return `t=${ts},v1=${sig}`;
}

describe("parseStripeSignatureHeader", () => {
  it("parses a valid header into timestamp and signatures", () => {
    const result = parseStripeSignatureHeader(
      "t=1234567890,v1=abc123,v1=def456",
    );
    expect(result).toEqual({
      timestamp: "1234567890",
      signatures: ["abc123", "def456"],
    });
  });

  it("returns null when timestamp is missing", () => {
    expect(parseStripeSignatureHeader("v1=abc123")).toBeNull();
  });

  it("returns null when v1 signatures are missing", () => {
    expect(parseStripeSignatureHeader("t=1234567890")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseStripeSignatureHeader("")).toBeNull();
  });

  it("ignores unknown prefixes", () => {
    const result = parseStripeSignatureHeader("t=9999,v2=othersig,v1=valid");
    expect(result).toEqual({ timestamp: "9999", signatures: ["valid"] });
  });
});

describe("verifyStripeSignature", () => {
  const secret = "whsec_test_secret";
  const rawBody = JSON.stringify({ event: "payment.created", amount: 100 });

  it("returns ok: true for a valid fresh signature", () => {
    const header = buildValidStripeHeader(rawBody, secret);
    const result = verifyStripeSignature(header, rawBody, secret);
    expect(result).toEqual({ ok: true });
  });

  it("returns ok: false for a missing/malformed header", () => {
    const result = verifyStripeSignature("garbage", rawBody, secret);
    expect(result.ok).toBe(false);
  });

  it("returns ok: false when the signature does not match", () => {
    const header = buildValidStripeHeader(rawBody, "wrong_secret");
    const result = verifyStripeSignature(header, rawBody, secret);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(
      /mismatch/i,
    );
  });

  it("returns ok: false when the timestamp is stale (> 5 minutes)", () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
    const header = buildValidStripeHeader(rawBody, secret, staleTimestamp);
    const result = verifyStripeSignature(header, rawBody, secret);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(
      /timestamp/i,
    );
  });

  it("returns ok: false for a non-numeric timestamp", () => {
    const header = "t=not-a-number,v1=abc123";
    const result = verifyStripeSignature(header, rawBody, secret);
    expect(result.ok).toBe(false);
  });

  it("accepts a signature from multiple v1 entries when any match", () => {
    const ts = Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${rawBody}`;
    const validSig = createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");
    const header = `t=${ts},v1=invalidsig,v1=${validSig}`;
    const result = verifyStripeSignature(header, rawBody, secret);
    expect(result).toEqual({ ok: true });
  });
});

describe("verifyProviderSignature", () => {
  const secret = "whsec_test_secret";
  const rawBody = JSON.stringify({ type: "charge.succeeded" });

  it("returns ok: true for null provider (slug-only, no signature required)", () => {
    const result = verifyProviderSignature({
      provider: null,
      headers: {},
      rawBody,
      secret: null,
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok: true for empty-string provider", () => {
    const result = verifyProviderSignature({
      provider: "",
      headers: {},
      rawBody,
      secret: null,
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok: false for unrecognized non-null provider (fail closed)", () => {
    const result = verifyProviderSignature({
      provider: "github",
      headers: {},
      rawBody,
      secret: null,
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(
      /Unsupported provider/i,
    );
  });

  it("returns ok: false for provider with different casing than supported", () => {
    const result = verifyProviderSignature({
      provider: "Stripe",
      headers: { "stripe-signature": "t=1,v1=abc" },
      rawBody,
      secret,
    });
    // "Stripe" normalizes to "stripe" — should pass through to Stripe verification
    // (will fail due to bad sig, but should NOT return unsupported provider error)
    expect((result as { ok: false; reason: string }).reason).not.toMatch(
      /Unsupported/i,
    );
  });

  it("returns ok: false for stripe provider when secret is missing", () => {
    const result = verifyProviderSignature({
      provider: "stripe",
      headers: { "stripe-signature": "t=1,v1=abc" },
      rawBody,
      secret: null,
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/secret/i);
  });

  it("returns ok: false for stripe provider when Stripe-Signature header is missing", () => {
    const result = verifyProviderSignature({
      provider: "stripe",
      headers: {},
      rawBody,
      secret,
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(
      /Missing Stripe-Signature/i,
    );
  });

  it("returns ok: true for stripe provider with a valid signature", () => {
    const ts = Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${rawBody}`;
    const sig = createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");
    const header = `t=${ts},v1=${sig}`;

    const result = verifyProviderSignature({
      provider: "stripe",
      headers: { "stripe-signature": header },
      rawBody,
      secret,
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok: false for stripe provider with an invalid signature", () => {
    const result = verifyProviderSignature({
      provider: "stripe",
      headers: {
        "stripe-signature": buildValidStripeHeader(rawBody, "wrong_secret"),
      },
      rawBody,
      secret,
    });
    expect(result.ok).toBe(false);
  });
});
