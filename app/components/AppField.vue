<template>
  <div :class="['field', state === 'err' && 'err', state === 'ok' && 'ok']">
    <span v-if="label" class="field-label">
      <span v-if="num" class="num">{{ num }}</span>
      <span>{{ label }}</span>
      <span v-if="req" class="req">*</span>
      <span v-if="opt" class="opt">optional</span>
    </span>
    <slot />
    <span
      v-if="msg"
      :class="['field-msg', state === 'err' && 'err', state === 'ok' && 'ok']"
    >
      <AppIcon v-if="state === 'err'" name="triangle" :size="13" />
      <AppIcon v-if="state === 'ok'" name="checkCircle" :size="13" />
      {{ msg }}
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    num?: string;
    label?: string;
    req?: boolean;
    opt?: boolean;
    msg?: string;
    state?: "" | "err" | "ok";
  }>(),
  {
    state: "",
    req: false,
    opt: false,
  },
);
</script>
