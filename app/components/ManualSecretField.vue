<template>
  <AppField :num="num" :label="label" :msg="hint" req>
    <div class="input-wrap">
      <span class="lead-addon"><AppIcon name="key" :size="16" /></span>
      <input
        :value="modelValue"
        class="input has-lead mono"
        style="font-size: 13.5px"
        type="password"
        @input="onInput"
      />
    </div>
  </AppField>
</template>

<script setup lang="ts">
// The masked "paste the provider-issued secret" input, shared by source
// creation (AddSourceModal.vue) and secret rotation (RotateSecretModal.vue) so
// the two collect a manual secret identically. v-model carries the value.
withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    hint?: string;
    num?: string;
  }>(),
  {
    hint: "",
    num: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function onInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>
