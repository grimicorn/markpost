import { createHash, randomBytes } from "crypto";

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
