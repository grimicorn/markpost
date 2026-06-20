<template>
  <div class="input-wrap">
    <input
      :class="['input', state && state]"
      :type="showPassword ? 'text' : 'password'"
      :value="modelValue"
      :placeholder="placeholder"
      style="padding-right: 44px"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span class="addon">
      <button class="icon-btn" type="button" :tabindex="-1" @click="showPassword = !showPassword">
        <AppIcon :name="showPassword ? 'eyeOff' : 'eye'" :size="17" />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    state?: "" | "err" | "ok";
  }>(),
  {
    modelValue: "",
    placeholder: "",
    state: "",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const showPassword = ref(false);
</script>
