<template>
  <div class="card card-pad">
    <div class="row between wrap gap-4">
      <div>
        <AppBadge :tone="planBadge.tone" dot>{{ planBadge.label }}</AppBadge>
        <p
          v-if="trialStatusLabel"
          class="mono faint"
          style="font-size: 12px; margin-top: 12px"
        >
          {{ trialStatusLabel }}
        </p>
      </div>
      <div class="col gap-2">
        <AppBtn
          variant="accent"
          icon="card"
          :disabled="isRedirecting"
          @click="emit('add-payment-method')"
        >
          {{ isRedirecting ? "redirecting…" : ctaLabel }}
        </AppBtn>
        <AppBtn variant="ghost" size="sm" href="/pricing"
          >compare plans →</AppBtn
        >
      </div>
    </div>
    <div v-if="redirectError" style="margin-top: 14px">
      <AppAlert tone="err">{{ redirectError }}</AppAlert>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  derivePlanBadge,
  deriveBillingCtaLabel,
  describeTrialStatus,
  type BillingUsage,
} from "../../composables/useBillingUsage";

const props = defineProps<{
  usage: BillingUsage;
  isRedirecting: boolean;
  redirectError: string | null;
}>();

const emit = defineEmits<{
  "add-payment-method": [];
}>();

const planBadge = computed(() =>
  derivePlanBadge(props.usage.plan, props.usage.status),
);

const ctaLabel = computed(() =>
  deriveBillingCtaLabel(props.usage.plan, props.usage.status),
);

const trialStatusLabel = computed(() =>
  describeTrialStatus(
    props.usage.status,
    props.usage.trialEndsAt,
    props.usage.trialDaysLeft,
  ),
);
</script>
