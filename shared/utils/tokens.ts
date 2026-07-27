// Canonical suggested lifetime for a new API token's expiry. The mint UI
// (app/components/settings/SetTokens.vue) prefills this value by default —
// expiry is opt-out, not opt-in — so the number shown in the client can
// never drift from the number this comment justifies.
//
// 90 days is a default suggestion, not enforced: the README frames these as
// long-lived CLI credentials, so a user who unchecks expiry still gets a
// token that never expires (server/db/schema.ts `expiresAt` is nullable and
// NULL = no expiry). 90 days is offered as a sensible middle ground for
// anyone who keeps the default — the same order of magnitude GitHub and
// GitLab suggest for personal access tokens — balancing CLI convenience
// against reducing the blast radius of a leaked token.
export const DEFAULT_TOKEN_EXPIRY_DAYS = 90;

// Bounds for the `expiresInDays` mint attribute (client defaults it on, but
// the server still accepts omitting/nulling it for a never-expiring token),
// shared so the mint UI (TokenExpiryFields.vue) can reject an out-of-range
// value before it ever reaches the server (server/api/tokens/index.post.ts
// enforces the same bounds — this is the one place both read them from).
export const MIN_TOKEN_EXPIRY_DAYS = 1;
export const MAX_TOKEN_EXPIRY_DAYS = 3650; // 10 years — a ceiling against fat-fingered values, not a policy.

// Shared so the client (formatting remaining lifetime) and server (computing
// an expiresAt from expiresInDays) use exactly one day-length constant.
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// A null/undefined expiresAt (never set, or a legacy pre-expiry token) never
// counts as expired. Shared so the server's auth check (server/middleware/
// auth.ts) and the client's display logic (SetTokens.vue) agree on the exact
// same boundary instead of maintaining two hand-written, easy-to-invert
// copies of the same rule.
export function isTokenExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() <= Date.now();
}
