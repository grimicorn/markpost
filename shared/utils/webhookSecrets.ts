// Header used by providers with no native signing capability (Zapier, Apple
// Shortcuts): the source's generated secret is sent back verbatim in this
// header and compared with a constant-time equality check. Both the server
// verifier (server/utils/signatureVerifier.ts) and the client copy that tells
// the user which header to configure (app/components/SourceCard.vue) import
// this so the two can never drift apart. Nuxt auto-resolves `shared/` for
// both the app and server layers — import via `#shared`, never a relative path.
export const SHARED_SECRET_HEADER = "x-markpost-secret";
