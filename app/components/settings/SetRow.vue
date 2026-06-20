<template>
  <div
    class="row between"
    style="padding: 18px 0; gap: 24px; align-items: flex-start"
  >
    <div class="col" style="gap: 3px; max-width: 300px">
      <span style="font-size: 14.5px; font-weight: 500">{{ label }}</span>
      <span
        v-if="hint"
        class="muted"
        style="font-size: 13px; line-height: 1.45"
        >{{ hint }}</span
      >
    </div>
    <div
      style="
        flex: 1;
        display: flex;
        justify-content: flex-end;
        max-width: 360px;
      "
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    hint?: string;
  }>(),
  {},
);
</script>
