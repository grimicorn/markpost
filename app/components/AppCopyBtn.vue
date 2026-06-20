<template>
  <button
    class="icon-btn mono"
    :style="{
      fontSize: '11px',
      gap: '5px',
      display: 'inline-flex',
      alignItems: 'center',
      color: copied ? 'var(--ok)' : 'var(--ink-3)',
    }"
    @click="handleCopy"
  >
    <AppIcon :name="copied ? 'check' : 'copy'" :size="13" />
    {{ copied ? "copied" : label }}
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text: string;
    label?: string;
  }>(),
  {
    label: "copy",
  },
);

const copied = ref(false);

const handleCopy = () => {
  try {
    navigator.clipboard.writeText(props.text);
  } catch {
    // clipboard not available in this context
  }
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1200);
};
</script>
