<template>
  <div
    style="
      position: fixed;
      inset: 0;
      background: color-mix(in oklab, #000 46%, transparent);
      display: grid;
      place-items: center;
      z-index: 60;
      padding: 24px;
    "
    @click="emit('cancel')"
  >
    <div
      class="card"
      style="
        width: 400px;
        max-width: 100%;
        box-shadow: var(--sh-pop);
        padding: 24px;
      "
      @click.stop
    >
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px">
        {{ title }}
      </h3>
      <p style="font-size: 14px; color: var(--ink-2); margin-bottom: 24px">
        {{ message }}
      </p>
      <div class="row gap-3" style="justify-content: flex-end">
        <AppBtn variant="ghost" @click="emit('cancel')">cancel</AppBtn>
        <AppBtn variant="accent" @click="emit('confirm')">{{
          confirmLabel
        }}</AppBtn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    message: string;
    confirmLabel?: string;
  }>(),
  {
    confirmLabel: "confirm",
  },
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>
