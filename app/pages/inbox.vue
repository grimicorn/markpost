<template>
  <TheAppShell active="inbox" crumb="WORKSPACE / DAN'S VAULT" title="Inbox">
    <template #actions>
      <AppBtn variant="accent" size="sm" icon="refresh">sync now</AppBtn>
    </template>

    <div style="padding: 22px 26px 40px; max-width: 1080px">
      <div v-if="showToast" style="margin-bottom: 18px">
        <AppAlert
          tone="ok"
          title="Sync complete"
          :closeable="true"
          @close="showToast = false"
        >
          Wrote <strong>3 new records</strong> to
          <code>~/vault/99-incoming</code> · 0 conflicts.
        </AppAlert>
      </div>

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
          v-for="stat in stats"
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
          >{{ filteredRecords.length }} records</span
        >
      </div>

      <!-- table -->
      <div class="card" style="overflow: hidden">
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
            v-for="(record, index) in filteredRecords"
            :key="index"
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
                :name="record.src === 'email' ? 'mail' : 'zap'"
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
                {{ record.name }}
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
              {{ record.title }}
            </span>
            <span
              class="mono"
              :style="{
                width: '230px',
                fontSize: '11.5px',
                color: record.file === '—' ? 'var(--ink-3)' : 'var(--info)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }"
            >
              {{ record.file }}
            </span>
            <span style="width: 90px">
              <AppBadge :tone="statusTone[record.status] ?? ''" dot>{{
                record.status
              }}</AppBadge>
            </span>
            <span
              class="mono faint"
              style="width: 80px; text-align: right; font-size: 11.5px"
            >
              {{ record.time }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </TheAppShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const showToast = ref(true);
const filter = ref("all");

const filterOptions = [
  { value: "all", label: "all" },
  { value: "webhook", label: "webhooks" },
  { value: "email", label: "email" },
  { value: "errors", label: "errors" },
];

const RECORDS = [
  {
    src: "webhook",
    name: "github · push",
    title: "Production deploy succeeded",
    file: "99-incoming/2026-06-14-deploy.md",
    time: "2m ago",
    status: "synced",
  },
  {
    src: "email",
    name: "clip@markpost",
    title: "A Deep Dive into Vue 3 Suspense",
    file: "99-incoming/vue-suspense.md",
    time: "14m ago",
    status: "synced",
  },
  {
    src: "webhook",
    name: "stripe · invoice",
    title: "Invoice #1042 paid — $80.00",
    file: "99-incoming/invoice-1042.md",
    time: "1h ago",
    status: "synced",
  },
  {
    src: "email",
    name: "clip@markpost",
    title: "Obsidian Canvas: a visual vault",
    file: "—",
    time: "1h ago",
    status: "pending",
  },
  {
    src: "webhook",
    name: "zapier · rss",
    title: "SvelteKit remote functions land",
    file: "99-incoming/sveltekit-remote.md",
    time: "3h ago",
    status: "synced",
  },
  {
    src: "webhook",
    name: "github · issue",
    title: "Bug: frontmatter date offset",
    file: "—",
    time: "5h ago",
    status: "error",
  },
  {
    src: "email",
    name: "clip@markpost",
    title: "Tailwind v4: ditch the config file",
    file: "99-incoming/tw4-config.md",
    time: "yesterday",
    status: "synced",
  },
];

const statusTone: Record<
  string,
  "" | "ok" | "warn" | "err" | "info" | "accent"
> = {
  synced: "ok",
  pending: "warn",
  error: "err",
};

const filteredRecords = computed(() => {
  if (filter.value === "all") {
    return RECORDS;
  }
  if (filter.value === "errors") {
    return RECORDS.filter((record) => record.status === "error");
  }
  return RECORDS.filter((record) => record.src === filter.value);
});

const stats = [
  { k: "synced today", v: "12", ic: "checkCircle", t: "ok" },
  { k: "pending", v: "1", ic: "clock", t: "warn" },
  { k: "errors", v: "1", ic: "triangle", t: "err" },
  { k: "this month", v: "284", sub: "/ ∞", ic: "fileText", t: "" },
];
</script>
