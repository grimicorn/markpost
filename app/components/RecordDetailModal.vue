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
    @click="emit('close')"
  >
    <div
      class="card"
      style="
        width: 640px;
        max-width: 100%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: var(--sh-pop);
        padding: 24px;
      "
      @click.stop
    >
      <div class="row between" style="margin-bottom: 18px">
        <span class="kicker">record detail</span>
        <AppBtn variant="ghost" size="sm" icon="x" @click="emit('close')"
          >close</AppBtn
        >
      </div>

      <div
        v-if="isLoading"
        class="col"
        style="
          align-items: center;
          padding: 40px 0;
          color: var(--ink-3);
          gap: 12px;
        "
      >
        <AppIcon name="refresh" :size="22" />
        <span class="mono" style="font-size: 13px">loading record…</span>
      </div>

      <AppAlert
        v-else-if="loadError"
        tone="err"
        title="Failed to load record"
        :closeable="false"
      >
        {{ loadError }}
      </AppAlert>

      <template v-else-if="record">
        <h3
          style="
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.01em;
            margin-bottom: 14px;
          "
        >
          {{ record.attributes.title }}
        </h3>

        <div
          class="row wrap gap-3"
          style="align-items: center; margin-bottom: 18px"
        >
          <span class="row gap-2">
            <AppIcon
              :name="sourceTypeIcon(record.attributes.source)"
              :size="15"
              :style="{ color: 'var(--accent)', flex: 'none' }"
            />
            <span class="mono" style="font-size: 12px; color: var(--ink-2)">
              {{ formatSourceLabel(record.attributes.source) }}
            </span>
          </span>
          <AppBadge :tone="STATUS_TONE_MAP[record.attributes.status] ?? ''" dot>
            {{ record.attributes.status }}
          </AppBadge>
          <span class="mono faint" style="font-size: 12px">
            {{ formatRelativeTime(record.attributes.createdAt) }}
          </span>
        </div>

        <dl class="detail-grid" style="margin-bottom: 18px">
          <dt class="kicker">file</dt>
          <dd
            class="mono"
            :style="{
              fontSize: '12px',
              color: record.attributes.filePath
                ? 'var(--info)'
                : 'var(--ink-3)',
              wordBreak: 'break-all',
            }"
          >
            {{ record.attributes.filePath ?? "—" }}
          </dd>

          <dt class="kicker">uuid</dt>
          <dd class="mono" style="font-size: 12px; word-break: break-all">
            {{ record.attributes.uuid }}
          </dd>
        </dl>

        <AppAlert
          v-if="record.attributes.errorMessage"
          tone="err"
          title="Sync error"
          :closeable="false"
          style="margin-bottom: 18px"
        >
          {{ record.attributes.errorMessage }}
        </AppAlert>

        <span class="kicker">content</span>
        <AppCodeBlock lang="markdown" :copy="record.attributes.content">{{
          record.attributes.content
        }}</AppCodeBlock>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  formatRelativeTime,
  formatSourceLabel,
  sourceTypeIcon,
  type RecordResource,
} from "~/composables/useRecords";

defineProps<{
  record: RecordResource | null;
  isLoading: boolean;
  loadError: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const STATUS_TONE_MAP: Record<
  string,
  "" | "ok" | "warn" | "err" | "info" | "accent"
> = {
  synced: "ok",
  pending: "warn",
  error: "err",
};
</script>

<style scoped>
.detail-grid {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 8px 16px;
  align-items: baseline;
}
</style>
