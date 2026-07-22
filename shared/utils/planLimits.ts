// Canonical Hobby plan limits — the single source of truth for the advertised
// caps. Both the client-facing billing copy (app/composables/useBillingUsage.ts)
// and the server-side write-path enforcement (server/utils/planLimits.ts) import
// these values so the number shown to the user and the number actually enforced
// can never drift apart. Nuxt auto-resolves `shared/` for both the app and
// server layers, so this is the one place that may define them.
export const HOBBY_MONTHLY_RECORD_LIMIT = 100;
export const HOBBY_CONNECTED_SOURCE_LIMIT = 1;
