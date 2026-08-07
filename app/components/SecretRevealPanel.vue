<template>
  <div>
    <div class="code">
      <div class="code-head">
        <span class="lang">{{ label }}</span>
        <AppCopyBtn :text="secret" :label="copyLabel" />
      </div>
      <div
        class="code-body mono"
        style="font-size: 12.5px; word-break: break-all"
      >
        {{ secret }}
      </div>
    </div>
    <div v-if="hint" class="muted" style="font-size: 11px; margin-top: 8px">
      {{ hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
// The one-time secret reveal affordance shared by source creation
// (AddSourceModal.vue) and secret rotation (RotateSecretModal.vue): a copyable
// code block for a value the server discloses exactly once, plus an optional
// hint on where to paste it. Kept as one component so both flows show an
// identical reveal.
withDefaults(
  defineProps<{
    label: string;
    secret: string;
    hint?: string;
    copyLabel?: string;
  }>(),
  {
    hint: "",
    copyLabel: "copy secret",
  },
);
</script>
