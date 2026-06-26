<template>
  <TheAppShell
    active="activity"
    crumb="WORKSPACE / DAN'S VAULT"
    title="Activity"
  >
    <template #actions>
      <AppBtn size="sm" icon="download">export log</AppBtn>
    </template>

    <div style="padding: 22px 26px 40px; max-width: 920px">
      <div class="row wrap gap-3" style="margin-bottom: 16px">
        <AppBadge tone="ok" dot>watcher running</AppBadge>
        <span class="mono faint" style="font-size: 12px">
          pid 4821 · uptime 3d 4h · ~/.markpost/markpost.log
        </span>
      </div>

      <div class="term">
        <div class="term-bar">
          <span class="dots"><i /><i /><i /></span>
          <span class="t-title">markpost sync --watch</span>
          <span class="grow" />
          <span class="t-title" style="margin-left: auto">live</span>
        </div>
        <div class="term-body" style="max-height: 420px; overflow-y: auto">
          <div
            v-for="([time, kind, message], index) in log"
            :key="index"
            style="display: flex; gap: 12px"
          >
            <span class="c-dim" style="flex: none">{{ time }}</span>
            <span
              :class="
                kind === 'ok'
                  ? 'c-ok'
                  : kind === 'dim'
                    ? 'c-dim'
                    : kind === 'warn'
                      ? 'c-warn'
                      : ''
              "
              :style="kind === 'err' ? { color: 'var(--err)' } : {}"
            >
              {{
                kind === "err"
                  ? "✗ "
                  : kind === "warn"
                    ? "! "
                    : kind === "ok"
                      ? "✓ "
                      : "  "
              }}{{ message }}
            </span>
          </div>
          <div style="display: flex; gap: 12px; margin-top: 6px">
            <span class="pr">$</span>
            <span style="border-left: 7px solid var(--accent)">&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  </TheAppShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const log = [
  ["09:41:02", "ok", "webhook github:push → 99-incoming/2026-06-14-deploy.md"],
  ["09:41:02", "dim", "frontmatter: title, source, created, tags[3]"],
  ["09:27:13", "ok", "email clip@markpost → 99-incoming/vue-suspense.md"],
  ["08:55:40", "ok", "webhook stripe:invoice → 99-incoming/invoice-1042.md"],
  ["08:55:41", "dim", "auto-delete: removed remote copy rec_a91f"],
  ["08:12:09", "warn", "email clip@markpost → pending (vault offline)"],
  ["07:48:30", "err", "webhook github:issue → conflict: file exists, skipped"],
  ["07:48:31", "dim", "retry scheduled in 00:05:00"],
  ["06:30:00", "ok", "scheduled sync complete · 9 records · 0 conflicts"],
] as [string, string, string][];
</script>
