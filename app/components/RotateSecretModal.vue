<template>
  <div
    style="
      position: fixed;
      inset: 0;
      background: color-mix(in oklab, #000 46%, transparent);
      display: grid;
      place-items: center;
      z-index: 60;
      padding: 24px;
    "
    @click="handleBackdropClick"
  >
    <div
      class="card"
      style="
        width: 480px;
        max-width: 100%;
        max-height: 90%;
        overflow: auto;
        box-shadow: var(--sh-pop);
      "
      @click.stop
    >
      <!-- head -->
      <div
        class="row between"
        style="padding: 18px 24px; border-bottom: 1px solid var(--line)"
      >
        <div class="col" style="gap: 2px">
          <span
            class="mono faint"
            style="
              font-size: 10.5px;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            "
          >
            {{ rotateState.source.name }}
          </span>
          <h3 style="font-size: 17px; font-weight: 600">{{ stepTitle }}</h3>
        </div>
        <button v-if="showCloseButton" class="icon-btn" @click="emit('close')">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <!-- step: confirm -->
      <div v-if="rotateState.step === 'confirm'" style="padding: 24px">
        <AppAlert tone="warn" title="This replaces the current secret">
          Rotating {{ warningDetail }} Deliveries verified with the old secret
          will be rejected until the new one is in place.
        </AppAlert>

        <div v-if="requiresManualSecret" style="margin-top: 16px">
          <ManualSecretField
            v-model="providerSecretInput"
            :label="manualSecretLabel"
            :hint="manualSecretHint"
          />
        </div>

        <div
          class="row gap-3"
          style="justify-content: flex-end; margin-top: 22px"
        >
          <AppBtn variant="ghost" @click="emit('close')">cancel</AppBtn>
          <AppBtn
            variant="accent"
            icon="refresh"
            :disabled="!canRotate"
            @click="handleRotate"
            >rotate secret</AppBtn
          >
        </div>
      </div>

      <!-- step: reveal (generated-secret providers — shown once, right after rotation) -->
      <div v-if="rotateState.step === 'reveal'" style="padding: 24px">
        <AppAlert tone="ok" title="Secret rotated">
          A new secret is live. Copy it now — for your security it will not be
          shown again.
        </AppAlert>

        <div style="margin-top: 16px">
          <SecretRevealPanel
            :label="revealSecretLabel"
            :secret="rotateState.revealSecret ?? ''"
            :hint="revealSecretHint"
          />
        </div>

        <div
          class="row gap-3"
          style="justify-content: flex-end; margin-top: 22px"
        >
          <AppBtn variant="accent" icon="check" @click="emit('close')"
            >done</AppBtn
          >
        </div>
      </div>

      <!-- step: done (manual-secret providers — nothing new to reveal) -->
      <div v-if="rotateState.step === 'done'" style="padding: 24px">
        <AppAlert tone="ok" title="Secret updated">
          The new secret is now in effect for
          <strong>{{ rotateState.source.name }}</strong
          >.
        </AppAlert>

        <div
          class="row gap-3"
          style="justify-content: flex-end; margin-top: 22px"
        >
          <AppBtn variant="accent" icon="check" @click="emit('close')"
            >done</AppBtn
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  MANUAL_SECRET_HINT,
  MANUAL_SECRET_LABEL,
  PROVIDER_SECRET_HINT,
  PROVIDER_SECRET_LABEL,
} from "../utils/providerSecretCopy";
import { isManualSecretProviderId } from "#shared/utils/webhookSecrets";
import type { RotateState } from "~/types/rotateSecret";

const props = withDefaults(
  defineProps<{
    rotateState: RotateState;
    // True while the parent's rotate request is in flight — guards against a
    // double-click firing two rotations, the second of which would win and
    // leave the first-revealed secret already replaced and unrecoverable.
    submitting?: boolean;
  }>(),
  { submitting: false },
);

const emit = defineEmits<{
  close: [];
  rotate: [providerSecret?: string];
}>();

const providerSecretInput = ref("");

const requiresManualSecret = computed(() =>
  isManualSecretProviderId(props.rotateState.source.provider),
);

const stepTitle = computed(() => {
  if (props.rotateState.step === "confirm") {
    return "Rotate secret";
  }
  if (props.rotateState.step === "reveal") {
    return "New secret";
  }
  return "Secret updated";
});

const warningDetail = computed(() => {
  if (requiresManualSecret.value) {
    return "swaps in the new signing secret you paste below and takes effect immediately.";
  }
  return "generates a brand-new secret and takes effect immediately.";
});

const revealSecretLabel = computed(
  () => PROVIDER_SECRET_LABEL[props.rotateState.source.provider] ?? "secret",
);

const revealSecretHint = computed(
  () => PROVIDER_SECRET_HINT[props.rotateState.source.provider] ?? "",
);

const manualSecretLabel = computed(
  () => MANUAL_SECRET_LABEL[props.rotateState.source.provider] ?? "secret",
);

const manualSecretHint = computed(
  () => MANUAL_SECRET_HINT[props.rotateState.source.provider] ?? "",
);

const canRotate = computed(() => {
  if (props.submitting) {
    return false;
  }
  return (
    !requiresManualSecret.value || providerSecretInput.value.trim().length > 0
  );
});

function handleRotate(): void {
  if (!canRotate.value) {
    return;
  }
  const secret = requiresManualSecret.value
    ? providerSecretInput.value.trim()
    : undefined;
  emit("rotate", secret);
}

// The reveal step discloses the freshly-generated secret once, so "done" is
// the only way out of it. Dismissal is also blocked while a rotation is in
// flight: the server may have already rotated, so closing here would strip the
// unrevealed new secret from the list and leave the source unrecoverable.
const showCloseButton = computed(
  () => props.rotateState.step !== "reveal" && !props.submitting,
);

function handleBackdropClick(): void {
  if (!showCloseButton.value) {
    return;
  }
  emit("close");
}
</script>
