<template>
  <div style="margin-bottom: 16px">
    <AppAlert tone="err" title="Load error">
      {{ message }}
      <AppBtn
        variant="ghost"
        size="sm"
        style="margin-top: 8px"
        :disabled="retrying"
        @click="emit('retry')"
      >
        retry
      </AppBtn>
    </AppAlert>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    message: string;
    retrying?: boolean;
  }>(),
  {
    retrying: false,
  },
);

const emit = defineEmits<{
  retry: [];
}>();
</script>
