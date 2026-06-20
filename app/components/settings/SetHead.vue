<template>
  <div style="margin-bottom: 24px">
    <AppEyebrow>{{ eyebrow }}</AppEyebrow>
    <h2 class="h2" style="margin-top: 12px">{{ title }}</h2>
    <p
      v-if="desc"
      class="muted"
      style="
        margin-top: 7px;
        font-size: 14.5px;
        line-height: 1.55;
        max-width: 520px;
      "
    >
      {{ desc }}
    </p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow: string;
    title: string;
    desc?: string;
  }>(),
  {},
);
</script>
