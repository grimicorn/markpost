<template>
  <div>
    <h3 class="h3" style="margin-top: 28px">Usage this month</h3>
    <div class="card" style="margin-top: 14px; padding: 4px 22px">
      <div class="divide-y">
        <SetRow label="Records created" :hint="recordsCreatedHint">
          <span class="mono" style="font-size: 13px">{{
            recordsCreatedLabel
          }}</span>
        </SetRow>
        <SetRow label="Connected sources" :hint="connectedSourcesHint">
          <span class="mono" style="font-size: 13px">{{
            connectedSourcesLabel
          }}</span>
        </SetRow>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SetRow from "./SetRow.vue";
import {
  describeRecordsCreatedHint,
  describeConnectedSourcesHint,
  type BillingUsage,
} from "../../composables/useBillingUsage";

const props = defineProps<{
  usage: BillingUsage | null;
}>();

const recordsCreatedLabel = computed(
  () => props.usage?.recordsCreatedThisMonth ?? "…",
);

const connectedSourcesLabel = computed(
  () => props.usage?.connectedSourceCount ?? "…",
);

const recordsCreatedHint = computed(() => {
  if (!props.usage) {
    return undefined;
  }
  return describeRecordsCreatedHint(
    props.usage.plan,
    props.usage.recordsCreatedThisMonth,
  );
});

const connectedSourcesHint = computed(() => {
  if (!props.usage) {
    return undefined;
  }
  return describeConnectedSourcesHint(
    props.usage.plan,
    props.usage.connectedSourceCount,
  );
});
</script>
