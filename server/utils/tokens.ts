import { createHash, randomBytes } from "crypto";
import { MILLISECONDS_PER_DAY } from "#shared/utils/tokens";

export const TOKEN_PREFIX = "mp_live_";
const TOKEN_RANDOM_BYTES = 32;
const HASH_ALGORITHM = "sha256";
const PREFIX_VISIBLE_CHARS = 4;

export function generateRawToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_RANDOM_BYTES).toString("hex")}`;
}

export function hashToken(rawToken: string): string {
  return createHash(HASH_ALGORITHM).update(rawToken).digest("hex");
}

export function extractTokenPrefix(rawToken: string): string {
  return rawToken.slice(0, TOKEN_PREFIX.length + PREFIX_VISIBLE_CHARS);
}

export function isApiToken(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX);
}

// Expiry is opt-in at mint time (server/api/tokens/index.post.ts): omitting
// expiresInDays returns null, which the schema stores as NULL — "never
// expires" — preserving today's behavior for anyone who doesn't ask for a
// bounded lifetime.
export function computeExpiresAt(expiresInDays?: number): Date | null {
  if (expiresInDays === undefined) {
    return null;
  }

  return new Date(Date.now() + expiresInDays * MILLISECONDS_PER_DAY);
}

// A null expiresAt (never set, or a legacy pre-expiry token) never counts as
// expired.
export function isTokenExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() <= Date.now();
}
