<template>
  <div class="row gap-3" style="align-items: center">
    <label class="switch">
      <input
        type="checkbox"
        :checked="modelValue"
        @change="
          emit('update:modelValue', ($event.target as HTMLInputElement).checked)
        "
      />
      <span class="track" />
      <span class="thumb" />
    </label>
    <span v-if="label" style="font-size: 14px">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: boolean;
    label?: string;
  }>(),
  {
    modelValue: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>
