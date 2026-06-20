<template>
  <span :class="['badge', tone && tone]">
    <i v-if="dot" class="dot" />
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: "" | "ok" | "warn" | "err" | "info" | "accent";
    dot?: boolean;
  }>(),
  {
    tone: "",
    dot: false,
  },
);
</script>
