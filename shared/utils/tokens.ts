// Canonical suggested lifetime for a new API token's expiry. The mint UI
// (app/components/settings/SetTokens.vue) prefills this value once a user
// opts into setting an expiration, so the number shown in the client can
// never drift from the number this comment justifies.
//
// 90 days is opt-in, not enforced: the README frames these as long-lived CLI
// credentials, so a token with no expiry requested still never expires
// (server/db/schema.ts `expiresAt` is nullable and NULL = no expiry). 90 days
// is offered only as a sensible middle ground for anyone who does want a
// bounded lifetime — the same order of magnitude GitHub and GitLab suggest
// for personal access tokens — balancing CLI convenience against reducing
// the blast radius of a leaked token.
export const DEFAULT_TOKEN_EXPIRY_DAYS = 90;

// Shared so the client (formatting remaining lifetime) and server (computing
// an expiresAt from expiresInDays) use exactly one day-length constant.
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
