const WEBHOOK_PREFIX = "wh_";
const EMAIL_PREFIX = "clip-";
const WEBHOOK_SLUG_LENGTH = 8;
const EMAIL_SLUG_LENGTH = 4;

function randomHex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

export function generateWebhookSlug(): string {
  return `${WEBHOOK_PREFIX}${randomHex(WEBHOOK_SLUG_LENGTH)}`;
}

export function generateEmailSlug(): string {
  return `${EMAIL_PREFIX}${randomHex(EMAIL_SLUG_LENGTH)}`;
}

export function generateEndpointSlug(type: string): string {
  if (type === "email") {
    return generateEmailSlug();
  }

  return generateWebhookSlug();
}
