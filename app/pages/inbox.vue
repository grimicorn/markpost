<template>
  <TheAppShell active="inbox" crumb="WORKSPACE / DAN'S VAULT" title="Inbox">
    <template #actions>
      <AppBtn
        variant="accent"
        size="sm"
        icon="refresh"
        :disabled="isSyncing"
        @click="syncNow"
        >sync now</AppBtn
      >
    </template>

    <div style="padding: 22px 26px 40px; max-width: 1080px">
      <div v-if="showToast" style="margin-bottom: 18px">
        <AppAlert
          tone="ok"
          title="Sync complete"
          :closeable="true"
          @close="showToast = false"
        >
          Records refreshed successfully.
        </AppAlert>
      </div>

      <AppAlert
        v-if="syncError"
        tone="err"
        title="Sync failed"
        :closeable="true"
        style="margin-bottom: 18px"
        @close="syncError = null"
      >
        {{ syncError }}
      </AppAlert>

      <!-- stat row -->
      <div
        style="
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 22px;
        "
      >
        <div
          v-for="stat in statsDisplay"
          :key="stat.k"
          class="card"
          style="padding: 16px"
        >
          <div class="row between">
            <span class="kicker">{{ stat.k }}</span>
            <AppIcon
              :name="stat.ic"
              :size="15"
              :style="{ color: stat.t ? `var(--${stat.t})` : 'var(--ink-3)' }"
            />
          </div>
          <div
            class="row"
            style="align-items: baseline; gap: 4px; margin-top: 10px"
          >
            <span
              style="font-size: 28px; font-weight: 600; letter-spacing: -0.02em"
              class="tnum"
            >
              {{ stat.v }}
            </span>
            <span v-if="stat.sub" class="mono faint" style="font-size: 12px">{{
              stat.sub
            }}</span>
          </div>
        </div>
      </div>

      <!-- filters -->
      <div class="row between wrap gap-3" style="margin-bottom: 14px">
        <InputSegmented v-model="filter" :options="filterOptions" />
        <span class="mono faint" style="font-size: 12px"
          >{{ records.length }} records</span
        >
      </div>

      <!-- loading state -->
      <div
        v-if="isLoading"
        class="col"
        style="
          align-items: center;
          padding: 60px 0;
          color: var(--ink-3);
          gap: 12px;
        "
      >
        <AppIcon name="refresh" :size="24" />
        <span class="mono" style="font-size: 13px">loading records…</span>
      </div>

      <!-- load error state -->
      <AppAlert
        v-else-if="loadError"
        tone="err"
        title="Failed to load records"
        :closeable="false"
      >
        {{ loadError }}
      </AppAlert>

      <!-- table -->
      <template v-else>
        <!-- empty state -->
        <div
          v-if="records.length === 0"
          class="col"
          style="
            align-items: center;
            padding: 60px 0;
            color: var(--ink-3);
            gap: 12px;
            text-align: center;
          "
        >
          <AppIcon name="inbox" :size="32" />
          <span style="font-size: 15px; font-weight: 500; color: var(--ink-2)"
            >No records yet</span
          >
          <span class="mono" style="font-size: 13px">
            Records will appear here once a source delivers them.
          </span>
        </div>

        <div v-else class="card" style="overflow: hidden">
          <div
            class="row"
            style="
              padding: 10px 18px;
              border-bottom: 1px solid var(--line);
              background: var(--bg-2);
              font-family: var(--mono);
              font-size: 10.5px;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              color: var(--ink-3);
            "
          >
            <span style="width: 120px">source</span>
            <span style="flex: 1">record</span>
            <span style="width: 230px">file</span>
            <span style="width: 90px">status</span>
            <span style="width: 80px; text-align: right">time</span>
          </div>
          <div class="divide-y">
            <div
              v-for="record in records"
              :key="record.id"
              class="row"
              style="
                padding: 13px 18px;
                cursor: pointer;
                transition: background 0.1s;
              "
              @mouseenter="
                ($event.currentTarget as HTMLElement).style.background =
                  'var(--bg-2)'
              "
              @mouseleave="
                ($event.currentTarget as HTMLElement).style.background =
                  'transparent'
              "
            >
              <span class="row gap-2" style="width: 120px">
                <AppIcon
                  :name="sourceTypeIcon(record.attributes.source)"
                  :size="15"
                  :style="{ color: 'var(--accent)', flex: 'none' }"
                />
                <span
                  class="mono"
                  style="
                    font-size: 11.5px;
                    color: var(--ink-2);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  "
                >
                  {{ formatSourceLabel(record.attributes.source) }}
                </span>
              </span>
              <span
                style="
                  flex: 1;
                  font-size: 14px;
                  font-weight: 500;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  padding-right: 16px;
                "
              >
                {{ record.attributes.title }}
              </span>
              <span
                class="mono"
                :style="{
                  width: '230px',
                  fontSize: '11.5px',
                  color: record.attributes.filePath
                    ? 'var(--info)'
                    : 'var(--ink-3)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }"
              >
                {{ record.attributes.filePath ?? "—" }}
              </span>
              <span style="width: 90px">
                <AppBadge
                  :tone="STATUS_TONE_MAP[record.attributes.status] ?? ''"
                  dot
                  >{{ record.attributes.status }}</AppBadge
                >
              </span>
              <span
                class="mono faint"
                style="width: 80px; text-align: right; font-size: 11.5px"
              >
                {{ formatRelativeTime(record.attributes.createdAt) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </TheAppShell>
</template>

<script setup lang="ts">
import {
  useRecords,
  fetchRecordStats,
  formatRelativeTime,
  type RecordStats,
} from "~/composables/useRecords";

definePageMeta({ middleware: "auth" });

const STATUS_TONE_MAP: Record<
  string,
  "" | "ok" | "warn" | "err" | "info" | "accent"
> = {
  synced: "ok",
  pending: "warn",
  error: "err",
};

const filterOptions = [
  { value: "all", label: "all" },
  { value: "webhook", label: "webhooks" },
  { value: "email", label: "email" },
  { value: "errors", label: "errors" },
];

const { records, isLoading, loadError, filter, loadRecords } =
  useRecords("all");

const showToast = ref(false);
const syncError = ref<string | null>(null);
const isSyncing = ref(false);
const stats = ref<RecordStats | null>(null);

const statsDisplay = computed(() => [
  {
    k: "synced today",
    v: stats.value !== null ? String(stats.value.syncedToday) : "—",
    ic: "checkCircle",
    t: "ok",
    sub: null,
  },
  {
    k: "pending",
    v: stats.value !== null ? String(stats.value.pending) : "—",
    ic: "clock",
    t: "warn",
    sub: null,
  },
  {
    k: "errors",
    v: stats.value !== null ? String(stats.value.errors) : "—",
    ic: "triangle",
    t: "err",
    sub: null,
  },
  {
    k: "this month",
    v: stats.value !== null ? String(stats.value.thisMonth) : "—",
    ic: "fileText",
    t: "",
    sub: "/ ∞",
  },
]);

function sourceTypeIcon(source: string | null): string {
  if (!source) {
    return "zap";
  }

  if (source.startsWith("email/")) {
    return "mail";
  }

  return "zap";
}

function formatSourceLabel(source: string | null): string {
  if (!source) {
    return "unknown";
  }

  const slashIndex = source.indexOf("/");
  if (slashIndex === -1) {
    return source;
  }

  return source.slice(slashIndex + 1).replaceAll("/", " · ");
}

async function refreshStats(): Promise<void> {
  const fetchedStats = await fetchRecordStats();
  if (fetchedStats !== null) {
    stats.value = fetchedStats;
  }
}

async function syncNow(): Promise<void> {
  isSyncing.value = true;
  syncError.value = null;
  showToast.value = false;

  try {
    await Promise.all([loadRecords(), refreshStats()]);

    if (loadError.value) {
      syncError.value = "Sync failed. Please try again.";
    } else {
      showToast.value = true;
    }
  } finally {
    isSyncing.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadRecords(), refreshStats()]);
});
</script>
