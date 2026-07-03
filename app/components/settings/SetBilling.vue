<template>
  <div>
    <SetHead eyebrow="billing" title="Billing" :desc="billingDescription" />

    <SetLoadErrorAlert
      v-if="loadError"
      :message="loadError"
      :retrying="isLoading"
      @retry="load"
    />

    <div v-if="!usage" class="card card-pad">
      <p class="mono faint" style="font-size: 13px">
        {{
          isLoading
            ? "loading billing details…"
            : "Billing details unavailable."
        }}
      </p>
    </div>
    <SetBillingPlanCard
      v-else
      :usage="usage"
      :is-redirecting="isRedirecting"
      :redirect-error="redirectError"
      @add-payment-method="addPaymentMethod"
    />

    <SetBillingUsageCard :usage="usage" />
  </div>
</template>

<script setup lang="ts">
import SetHead from "./SetHead.vue";
import SetLoadErrorAlert from "./SetLoadErrorAlert.vue";
import SetBillingPlanCard from "./SetBillingPlanCard.vue";
import SetBillingUsageCard from "./SetBillingUsageCard.vue";
import { describeBillingState } from "../../composables/useBillingUsage";
import { useBillingSettings } from "../../composables/useBillingSettings";

const {
  usage,
  isLoading,
  loadError,
  isRedirecting,
  redirectError,
  load,
  addPaymentMethod,
} = useBillingSettings();

const billingDescription = computed(() => {
  if (loadError.value) {
    return "Unable to load your billing details. Try again below.";
  }
  if (!usage.value) {
    return "Loading your billing details…";
  }
  return describeBillingState(usage.value.plan, usage.value.status);
});

onMounted(() => {
  load();
});
</script>
