<template>
  <AppField
    :num="num"
    :label="label"
    :req="req"
    :opt="opt"
    :msg="msg"
    :state="state"
  >
    <textarea
      class="textarea"
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      @input="
        emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
      "
    />
  </AppField>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    num?: string;
    placeholder?: string;
    state?: "" | "err" | "ok";
    msg?: string;
    req?: boolean;
    opt?: boolean;
    rows?: number;
  }>(),
  {
    modelValue: "",
    state: "",
    req: false,
    opt: false,
    rows: 4,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
