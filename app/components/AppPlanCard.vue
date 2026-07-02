<template>
  <div class="panel" style="padding: 12px; margin-bottom: 12px">
    <div class="row between">
      <AppBadge :tone="badge.tone" dot>{{ badge.label }}</AppBadge>
      <span
        v-if="trialDaysLeft !== null"
        class="mono faint"
        style="font-size: 11px"
      >
        {{ trialDaysLeft }}d left
      </span>
    </div>
    <div
      v-if="trialPercentElapsed !== null"
      style="
        height: 5px;
        border-radius: 99px;
        background: var(--bg-2);
        margin-top: 10px;
        overflow: hidden;
      "
    >
      <div
        :style="{
          width: `${trialPercentElapsed}%`,
          height: '100%',
          background: 'var(--accent)',
        }"
      />
    </div>
    <NuxtLink
      to="/pricing"
      class="mono"
      style="
        font-size: 11.5px;
        color: var(--accent-700);
        margin-top: 10px;
        display: block;
        background: none;
        border: 0;
        cursor: pointer;
        padding: 0;
      "
    >
      upgrade plan →
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { PlanBadge } from "~/composables/useBillingUsage";

defineProps<{
  badge: PlanBadge;
  trialDaysLeft: number | null;
  trialPercentElapsed: number | null;
}>();
</script>
