<template>
  <div class="input-wrap" style="display: flex">
    <span class="lead-addon"><AppIcon name="search" :size="15" /></span>
    <input
      ref="inputRef"
      v-model="query"
      class="input has-lead"
      placeholder="search records…"
      style="height: 36px; width: 190px; font-size: 13px"
      @focus="isFocused = true"
      @blur="isFocused = false"
      @keydown.esc="close"
      @keydown.enter="selectTopResult"
    />
    <span class="addon"><AppKbd>⌘K</AppKbd></span>

    <div
      v-if="showResults"
      class="card"
      style="
        position: absolute;
        top: 44px;
        left: 0;
        right: 0;
        z-index: 20;
        overflow: hidden;
      "
    >
      <button
        v-for="result in results"
        :key="result.id"
        class="row gap-2"
        style="
          width: 100%;
          text-align: left;
          border: 0;
          background: transparent;
          cursor: pointer;
          padding: 8px 12px;
          font-size: 13px;
        "
        @mousedown.prevent
        @click="selectRecord(result)"
      >
        <AppIcon
          name="fileText"
          :size="14"
          :style="{ color: 'var(--ink-3)', flex: 'none' }"
        />
        <span
          style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
        >
          {{ result.attributes.title }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRecordSearch } from "~/composables/useRecordSearch";
import type { RecordResource } from "~/composables/useRecords";

const emit = defineEmits<{ select: [record: RecordResource] }>();

const { query, results, clearResults } = useRecordSearch();
const inputRef = ref<HTMLInputElement | null>(null);
const isFocused = ref(false);

const showResults = computed(() => isFocused.value && results.value.length > 0);

function close(): void {
  query.value = "";
  clearResults();
  inputRef.value?.blur();
}

function selectRecord(record: RecordResource): void {
  close();
  emit("select", record);
}

function selectTopResult(): void {
  const topResult = results.value[0];
  if (!topResult) {
    return;
  }
  selectRecord(topResult);
}

function focus(): void {
  inputRef.value?.focus();
}

defineExpose({ focus });
</script>
