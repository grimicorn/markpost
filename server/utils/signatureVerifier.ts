import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SHARED_SECRET_HEADER } from "#shared/utils/webhookSecrets";

const STRIPE_SIGNATURE_HEADER = "stripe-signature";
const STRIPE_TIMESTAMP_PREFIX = "t=";
const STRIPE_V1_PREFIX = "v1=";
const STRIPE_TIMESTAMP_TOLERANCE_SECONDS = 300;

// GitHub signs deliveries with a per-webhook secret the user pastes into their
// repo's webhook settings, so verification needs that source's own secret
// rather than a single global one.
const GITHUB_SIGNATURE_HEADER = "x-hub-signature-256";
const GITHUB_SIGNATURE_PREFIX = "sha256=";

// 24 random bytes -> 48 hex chars, ~192 bits of entropy: comfortably beyond
// brute-force range for a value transmitted over HTTPS only.
const PROVIDER_SECRET_BYTE_LENGTH = 24;

// Providers verified via a per-source secret generated at source-creation time
// (as opposed to Stripe, which verifies against the app-wide STRIPE_WEBHOOK_SECRET).
export const SECRET_BACKED_PROVIDERS = [
  "github",
  "zapier",
  "shortcuts",
] as const;
export type SecretBackedProvider = (typeof SECRET_BACKED_PROVIDERS)[number];

export function isSecretBackedProvider(
  provider: string,
): provider is SecretBackedProvider {
  return (SECRET_BACKED_PROVIDERS as readonly string[]).includes(provider);
}

export function generateProviderSecret(): string {
  return randomBytes(PROVIDER_SECRET_BYTE_LENGTH).toString("hex");
}

export type VerificationResult = { ok: true } | { ok: false; reason: string };

export type StripeSignatureParts = {
  timestamp: string;
  signatures: string[];
};

export function parseStripeSignatureHeader(
  header: string,
): StripeSignatureParts | null {
  const parts = header.split(",");
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();

    if (trimmed.startsWith(STRIPE_TIMESTAMP_PREFIX)) {
      timestamp = trimmed.slice(STRIPE_TIMESTAMP_PREFIX.length);
      continue;
    }

    if (trimmed.startsWith(STRIPE_V1_PREFIX)) {
      signatures.push(trimmed.slice(STRIPE_V1_PREFIX.length));
    }
  }

  if (!timestamp || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

function computeStripeSignature(
  timestamp: string,
  rawBody: string,
  secret: string,
): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  return createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
}

function isTimestampFresh(timestamp: string): boolean {
  if (!/^\d+$/.test(timestamp)) {
    return false;
  }

  const timestampSeconds = parseInt(timestamp, 10);

  if (Number.isNaN(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return (
    Math.abs(nowSeconds - timestampSeconds) <=
    STRIPE_TIMESTAMP_TOLERANCE_SECONDS
  );
}

function signaturesMatch(expected: Buffer, candidate: string): boolean {
  const candidateBuffer = Buffer.from(candidate, "hex");
  // Buffer.from("hex") silently drops invalid chars producing a shorter buffer;
  // the length check below catches that mismatch.
  return (
    expected.length === candidateBuffer.length &&
    timingSafeEqual(expected, candidateBuffer)
  );
}

function compareSignatures(expected: string, candidates: string[]): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");
  return candidates.some((candidate) =>
    signaturesMatch(expectedBuffer, candidate),
  );
}

export function verifyStripeSignature(
  signatureHeader: string,
  rawBody: string,
  secret: string,
): VerificationResult {
  const parsed = parseStripeSignatureHeader(signatureHeader);

  if (!parsed) {
    return { ok: false, reason: "Invalid Stripe-Signature header format" };
  }

  if (!isTimestampFresh(parsed.timestamp)) {
    return {
      ok: false,
      reason: "Stripe webhook timestamp is too old or invalid",
    };
  }

  const expected = computeStripeSignature(parsed.timestamp, rawBody, secret);

  if (!compareSignatures(expected, parsed.signatures)) {
    return { ok: false, reason: "Stripe webhook signature mismatch" };
  }

  return { ok: true };
}

export function verifyGithubSignature(
  signatureHeader: string,
  rawBody: string,
  secret: string,
): VerificationResult {
  if (!signatureHeader.startsWith(GITHUB_SIGNATURE_PREFIX)) {
    return { ok: false, reason: "Invalid X-Hub-Signature-256 header format" };
  }

  const candidate = signatureHeader.slice(GITHUB_SIGNATURE_PREFIX.length);
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  if (!compareSignatures(expected, [candidate])) {
    return { ok: false, reason: "GitHub webhook signature mismatch" };
  }

  return { ok: true };
}

export function verifySharedSecret(
  providedSecret: string | undefined,
  secret: string,
): VerificationResult {
  if (!providedSecret) {
    return {
      ok: false,
      reason: `Missing ${SHARED_SECRET_HEADER} header`,
    };
  }

  const providedBuffer = Buffer.from(providedSecret, "utf8");
  const expectedBuffer = Buffer.from(secret, "utf8");
  const matches =
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);

  if (!matches) {
    return { ok: false, reason: "Webhook secret mismatch" };
  }

  return { ok: true };
}

export type ProviderSignatureInput = {
  provider: string | null;
  headers: Record<string, string | undefined>;
  rawBody: string;
  secret: string | null;
};

function normalizeProvider(provider: string | null): string {
  return provider?.toLowerCase().trim() ?? "";
}

function verifyStripeProvider(
  input: ProviderSignatureInput,
): VerificationResult {
  if (!input.secret) {
    return { ok: false, reason: "Stripe webhook secret is not configured" };
  }

  const signatureHeader = input.headers[STRIPE_SIGNATURE_HEADER];

  if (!signatureHeader) {
    return { ok: false, reason: "Missing Stripe-Signature header" };
  }

  return verifyStripeSignature(signatureHeader, input.rawBody, input.secret);
}

function verifyGithubProvider(
  input: ProviderSignatureInput,
): VerificationResult {
  if (!input.secret) {
    return { ok: false, reason: "GitHub webhook secret is not configured" };
  }

  const signatureHeader = input.headers[GITHUB_SIGNATURE_HEADER];

  if (!signatureHeader) {
    return { ok: false, reason: "Missing X-Hub-Signature-256 header" };
  }

  return verifyGithubSignature(signatureHeader, input.rawBody, input.secret);
}

function verifySharedSecretProvider(
  input: ProviderSignatureInput,
): VerificationResult {
  if (!input.secret) {
    return {
      ok: false,
      reason: "Webhook secret is not configured for this source",
    };
  }

  return verifySharedSecret(input.headers[SHARED_SECRET_HEADER], input.secret);
}

export function verifyProviderSignature(
  input: ProviderSignatureInput,
): VerificationResult {
  const provider = normalizeProvider(input.provider);

  if (provider === "") {
    // No provider configured: slug-only authentication, no signature required.
    return { ok: true };
  }

  if (provider === "stripe") {
    return verifyStripeProvider(input);
  }

  if (provider === "github") {
    return verifyGithubProvider(input);
  }

  if (provider === "zapier" || provider === "shortcuts") {
    return verifySharedSecretProvider(input);
  }

  return {
    ok: false,
    reason: `Unsupported provider for signature verification: ${input.provider}`,
  };
}
