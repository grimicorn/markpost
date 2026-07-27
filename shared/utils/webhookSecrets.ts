// Header used by providers with no native signing capability (Zapier, Apple
// Shortcuts): the source's generated secret is sent back verbatim in this
// header and compared with a constant-time equality check. Both the server
// verifier (server/utils/signatureVerifier.ts) and the client copy that tells
// the user which header to configure (app/utils/providerSecretCopy.ts, used
// by AddSourceModal.vue's reveal step and SourceCard.vue's ongoing hint)
// import this so the two can never drift apart. Nuxt auto-resolves `shared/`
// for both the app and server layers — import via `#shared`, never a
// relative path.
export const SHARED_SECRET_HEADER = "x-markpost-secret";

// The providers verified via that header (as opposed to GitHub/Stripe, which
// sign with a real HMAC). Defined here rather than only in
// server/utils/signatureVerifier.ts so app/components/SourceCard.vue can
// import the same list — a server file pulls in node:crypto, which breaks
// the client bundle.
export const SHARED_SECRET_PROVIDER_IDS = ["zapier", "shortcuts"] as const;
