<template>
  <AppField
    :num="num"
    :label="label"
    :req="req"
    :opt="opt"
    :msg="msg"
    :state="state"
  >
    <div class="input-wrap">
      <span v-if="leadIcon" class="lead-addon">
        <AppIcon :name="leadIcon" :size="16" />
      </span>
      <input
        :class="['input', leadIcon && 'has-lead']"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="
          emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
        @blur="emit('blur')"
      />
    </div>
  </AppField>
</template>

<script setup lang="ts">
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
    disabled?: boolean;
    leadIcon?: string;
    type?: "text" | "email" | "search";
  }>(),
  {
    modelValue: "",
    state: "",
    req: false,
    opt: false,
    disabled: false,
    type: "text",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  blur: [];
}>();
</script>
