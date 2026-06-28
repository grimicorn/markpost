import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_SIGNATURE_HEADER = "stripe-signature";
const STRIPE_TIMESTAMP_PREFIX = "t=";
const STRIPE_V1_PREFIX = "v1=";
const STRIPE_TIMESTAMP_TOLERANCE_SECONDS = 300;

type VerificationResult = { ok: true } | { ok: false; reason: string };

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

function compareSignatures(expected: string, candidates: string[]): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");

  for (const candidate of candidates) {
    try {
      const candidateBuffer = Buffer.from(candidate, "hex");

      if (
        expectedBuffer.length === candidateBuffer.length &&
        timingSafeEqual(expectedBuffer, candidateBuffer)
      ) {
        return true;
      }
    } catch {
      // Buffer.from can throw on invalid hex; treat as mismatch
    }
  }

  return false;
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

export type ProviderSignatureInput = {
  provider: string | null;
  headers: Record<string, string | undefined>;
  rawBody: string;
  secret: string | null;
};

export function verifyProviderSignature(
  input: ProviderSignatureInput,
): VerificationResult {
  if (input.provider !== "stripe") {
    return { ok: true };
  }

  if (!input.secret) {
    return { ok: false, reason: "Stripe webhook secret is not configured" };
  }

  const signatureHeader = input.headers[STRIPE_SIGNATURE_HEADER];

  if (!signatureHeader) {
    return { ok: false, reason: "Missing Stripe-Signature header" };
  }

  return verifyStripeSignature(signatureHeader, input.rawBody, input.secret);
}
