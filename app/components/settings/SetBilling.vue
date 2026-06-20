<template>
  <div>
    <SetHead
      eyebrow="billing"
      title="Billing"
      desc="You're on the Pro trial. Add a payment method any time before it ends to keep Pro features."
    />
    <div class="card card-pad">
      <div class="row between wrap gap-4">
        <div>
          <AppBadge tone="accent" dot>pro trial</AppBadge>
          <div
            class="row"
            style="align-items: baseline; gap: 6px; margin-top: 12px"
          >
            <span style="font-size: 30px; font-weight: 600">$8</span>
            <span class="mono faint" style="font-size: 13px"
              >/mo · billed yearly after trial</span
            >
          </div>
          <p class="mono faint" style="font-size: 12px; margin-top: 8px">
            trial ends Jun 23, 2026 · 9 days left
          </p>
        </div>
        <div class="col gap-2">
          <AppBtn variant="accent" icon="card">add payment method</AppBtn>
          <AppBtn variant="ghost" size="sm" href="/pricing"
            >compare plans →</AppBtn
          >
        </div>
      </div>
    </div>

    <h3 class="h3" style="margin-top: 28px">Usage this month</h3>
    <div class="card" style="margin-top: 14px; padding: 4px 22px">
      <div class="divide-y">
        <SetRow label="Records synced" hint="284 of unlimited on Pro.">
          <span class="mono" style="font-size: 13px">284</span>
        </SetRow>
        <SetRow label="Connected sources" hint="2 of unlimited.">
          <span class="mono" style="font-size: 13px">2</span>
        </SetRow>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SetHead from "./SetHead.vue";
import SetRow from "./SetRow.vue";
</script>
