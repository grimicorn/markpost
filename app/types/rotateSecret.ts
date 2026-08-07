// The rotate-secret modal's contract, shared by RotateSecretModal.vue (which
// renders each step) and the sources page (which drives the flow) so a change
// to the steps or payload can't leave the two out of sync.

export interface RotateSource {
  uuid: string;
  provider: string;
  name: string;
}

export interface RotateState {
  step: "confirm" | "reveal" | "done";
  source: RotateSource;
  // Set by the page once rotation succeeds for a generated-secret provider;
  // drives the one-time reveal step. Manual-secret providers never reveal.
  revealSecret?: string | null;
}
