import { SHARED_SECRET_HEADER } from "#shared/utils/webhookSecrets";

// Keyed by preset/provider id. Only presets that generate a providerSecret
// (github/zapier/shortcuts — see server/utils/signatureVerifier.ts's
// SECRET_BACKED_PROVIDERS) need an entry here.
export const PROVIDER_SECRET_LABEL: Record<string, string> = {
  github: "webhook secret",
  zapier: "shared secret",
  shortcuts: "shared secret",
};

export const PROVIDER_SECRET_HINT: Record<string, string> = {
  github:
    "Paste this into the GitHub repo's Settings -> Webhooks -> Secret field.",
  zapier: `Add it as a custom header named ${SHARED_SECRET_HEADER} on the Zapier webhook action.`,
  shortcuts: `Add it as a custom header named ${SHARED_SECRET_HEADER} in the "Get Contents of URL" action.`,
};

// Keyed by provider id, for providers whose secret the user supplies rather
// than markpost generating it (Stripe — see MANUAL_SECRET_PROVIDER_IDS). Used
// by the manual-secret input shown at both source creation (AddSourceModal.vue)
// and secret rotation (RotateSecretModal.vue), so the two prompts stay in sync.
export const MANUAL_SECRET_LABEL: Record<string, string> = {
  stripe: "Stripe webhook signing secret",
};

export const MANUAL_SECRET_HINT: Record<string, string> = {
  stripe:
    "From your Stripe Dashboard -> Webhooks -> your endpoint -> Signing secret.",
};
