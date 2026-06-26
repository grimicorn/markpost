<template>
  <span v-if="!target" />
  <button
    v-else
    class="card"
    :style="{
      padding: '12px 16px',
      cursor: 'pointer',
      textAlign: dir === 'prev' ? 'left' : 'right',
      background: 'var(--surface)',
      minWidth: '160px',
    }"
    @click="emit('navigate', target[0])"
  >
    <span
      class="mono faint"
      style="
        font-size: 10.5px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      "
    >
      {{ dir }}
    </span>
    <div
      class="row gap-2"
      :style="{
        marginTop: '4px',
        justifyContent: dir === 'prev' ? 'flex-start' : 'flex-end',
        color: 'var(--accent-700)',
        fontSize: '14px',
        fontWeight: 500,
      }"
    >
      <AppIcon
        v-if="dir === 'prev'"
        name="chevR"
        :size="15"
        :style="{ transform: 'rotate(180deg)' }"
      />
      {{ target[1] }}
      <AppIcon v-if="dir === 'next'" name="chevR" :size="15" />
    </div>
  </button>
</template>

<script setup lang="ts">
const DOC_FLAT = [
  ["quickstart", "Quickstart"],
  ["concepts", "Core concepts"],
  ["auth", "Authentication"],
  ["webhooks", "Ingest a webhook"],
  ["email", "Email-in"],
  ["records", "List records"],
  ["cli", "Command reference"],
  ["markdown", "Markdown & frontmatter"],
] as [string, string][];

const props = defineProps<{
  dir: "prev" | "next";
  page: string;
}>();

const emit = defineEmits<{
  navigate: [id: string];
}>();

const target = computed(() => {
  const index = DOC_FLAT.findIndex(([id]) => id === props.page);
  if (props.dir === "prev") {
    return DOC_FLAT[index - 1] ?? null;
  }
  return DOC_FLAT[index + 1] ?? null;
});
</script>
