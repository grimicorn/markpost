<template>
  <label class="row gap-3" style="align-items: center; cursor: pointer">
    <span class="switch">
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        @change="
          emit('update:modelValue', ($event.target as HTMLInputElement).checked)
        "
      />
      <span class="track" />
      <span class="thumb" />
    </span>
    <span v-if="label" style="font-size: 14px">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: boolean;
    label?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>
