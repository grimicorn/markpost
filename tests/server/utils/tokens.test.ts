import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOKEN_PREFIX,
  computeExpiresAt,
  extractTokenPrefix,
  generateRawToken,
  hashToken,
  isApiToken,
  isTokenExpired,
} from "../../../server/utils/tokens";

// These strings are non-secret test fixtures, not real tokens.
const FIXTURE_TOKEN_SHORT = "mp_live_abc123"; // gitleaks:allow
const FIXTURE_TOKEN_LONG = "mp_live_abcdef1234"; // gitleaks:allow

describe("generateRawToken", () => {
  it("starts with the mp_live_ prefix", () => {
    const token = generateRawToken();
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true);
  });

  it("generates unique tokens on each call", () => {
    const firstToken = generateRawToken();
    const secondToken = generateRawToken();
    expect(firstToken).not.toBe(secondToken);
  });

  it("has sufficient length for a 32-byte hex payload", () => {
    const token = generateRawToken();
    const hexPart = token.slice(TOKEN_PREFIX.length);
    expect(hexPart.length).toBe(64);
  });
});

describe("hashToken", () => {
  it("returns a deterministic hex string for the same input", () => {
    expect(hashToken(FIXTURE_TOKEN_SHORT)).toBe(hashToken(FIXTURE_TOKEN_SHORT));
  });

  it("returns different hashes for different inputs", () => {
    expect(hashToken("mp_live_aaa")).not.toBe(hashToken("mp_live_bbb")); // gitleaks:allow
  });

  it("never returns the original token value", () => {
    expect(hashToken(FIXTURE_TOKEN_SHORT)).not.toBe(FIXTURE_TOKEN_SHORT);
  });

  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashToken("mp_live_test"); // gitleaks:allow
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractTokenPrefix", () => {
  it("returns the prefix plus four extra characters", () => {
    const extracted = extractTokenPrefix(FIXTURE_TOKEN_LONG);
    expect(extracted).toBe("mp_live_abcd");
  });

  it("has the expected length", () => {
    const token = generateRawToken();
    const extracted = extractTokenPrefix(token);
    expect(extracted.length).toBe(TOKEN_PREFIX.length + 4);
  });
});

describe("computeExpiresAt", () => {
  const NOW = new Date("2026-06-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when expiresInDays is omitted (never expires)", () => {
    expect(computeExpiresAt(undefined)).toBeNull();
  });

  it("returns a Date offset by the given number of days", () => {
    const expiresAt = computeExpiresAt(90);
    expect(expiresAt).toEqual(new Date("2026-08-30T00:00:00.000Z"));
  });

  it("returns a Date one day out for expiresInDays of 1", () => {
    const expiresAt = computeExpiresAt(1);
    expect(expiresAt).toEqual(new Date("2026-06-02T00:00:00.000Z"));
  });
});

describe("isTokenExpired", () => {
  it("returns false for a null expiresAt (never expires)", () => {
    expect(isTokenExpired(null)).toBe(false);
  });

  it("returns false for an undefined expiresAt (legacy row shape)", () => {
    expect(isTokenExpired(undefined)).toBe(false);
  });

  it("returns false for a future expiresAt", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isTokenExpired(future)).toBe(false);
  });

  it("returns true for a past expiresAt", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isTokenExpired(past)).toBe(true);
  });

  it("returns true for an expiresAt exactly at the current instant", () => {
    const now = new Date();
    expect(isTokenExpired(now)).toBe(true);
  });
});

describe("isApiToken", () => {
  it("returns true for mp_live_ prefixed tokens", () => {
    expect(isApiToken(FIXTURE_TOKEN_SHORT)).toBe(true);
  });

  it("returns false for Clerk JWTs", () => {
    expect(isApiToken("eyJhbGciOiJSUzI1NiJ9.payload.signature")).toBe(false);
  });

  it("returns false for empty strings", () => {
    expect(isApiToken("")).toBe(false);
  });

  it("returns false for strings that partially match the prefix", () => {
    expect(isApiToken("mp_live")).toBe(false);
    expect(isApiToken("mp_")).toBe(false);
  });
});
