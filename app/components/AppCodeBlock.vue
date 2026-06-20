<template>
  <div class="code" style="margin: 18px 0">
    <div class="code-head">
      <span class="lang">{{ lang }}</span>
      <AppCopyBtn v-if="copy" :text="copy" />
    </div>
    <div class="code-body" style="white-space: pre; line-height: 1.7">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    lang?: string;
    copy?: string;
  }>(),
  {
    lang: "",
    copy: "",
  },
);
</script>
