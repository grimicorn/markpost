<template>
  <div>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">Commands</h2>
    <div class="card" style="overflow: hidden; margin: 14px 0">
      <div
        v-for="([cmd, desc], index) in commands"
        :key="cmd"
        class="row"
        :style="{
          padding: '12px 16px',
          borderTop: index ? '1px solid var(--line)' : 0,
          gap: '16px',
        }"
      >
        <span
          class="mono"
          style="width: 170px; font-size: 12.5px; color: var(--accent-700)"
        >
          markpost {{ cmd }}
        </span>
        <span style="font-size: 13.5px; color: var(--ink-2)">{{ desc }}</span>
      </div>
    </div>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">
      Common flags
    </h2>
    <AppCodeBlock lang="bash">
      <span class="k">--dir</span>
      <span class="c">path to vault (default: cwd)</span>{{ "\n"
      }}<span class="k">--watch</span> <span class="c">stay running</span
      >{{ "\n" }}<span class="k">--no-delete</span>
      <span class="c">keep server copies after sync</span>{{ "\n"
      }}<span class="k">--dry-run</span>
      <span class="c">preview without writing files</span>
    </AppCodeBlock>
  </div>
</template>

<script setup lang="ts">
const commands = [
  ["auth <token>", "store an API token on this machine"],
  ["sync", "write pending records to the vault"],
  ["sync --watch", "run continuously and sync on arrival"],
  ["config pull", "refresh sync settings from your account"],
  ["sources", "list connected sources"],
  ["status", "show watcher state and last sync"],
] as [string, string][];
</script>
