<template>
  <span :class="['chip', accent && 'accent']">
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    accent?: boolean;
  }>(),
  {
    accent: false,
  },
);
</script>
