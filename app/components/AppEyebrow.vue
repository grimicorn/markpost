<template>
  <span :class="['eyebrow', dash && 'dash']">
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    dash?: boolean;
  }>(),
  {
    dash: false,
  },
);
</script>
