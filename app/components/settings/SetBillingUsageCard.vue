<template>
  <div>
    <h3 class="h3" style="margin-top: 28px">Usage this month</h3>
    <div class="card" style="margin-top: 14px; padding: 4px 22px">
      <div class="divide-y">
        <SetRow label="Records synced" :hint="recordsSyncedHint">
          <span class="mono" style="font-size: 13px">{{
            recordsSyncedLabel
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
  describeRecordsSyncedHint,
  describeConnectedSourcesHint,
  type BillingUsage,
} from "../../composables/useBillingUsage";

const props = defineProps<{
  usage: BillingUsage | null;
}>();

const recordsSyncedLabel = computed(
  () => props.usage?.recordsSyncedThisMonth ?? "…",
);

const connectedSourcesLabel = computed(
  () => props.usage?.connectedSourceCount ?? "…",
);

const recordsSyncedHint = computed(() => {
  if (!props.usage) {
    return undefined;
  }
  return describeRecordsSyncedHint(
    props.usage.plan,
    props.usage.recordsSyncedThisMonth,
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
