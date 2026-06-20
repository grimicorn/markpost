<template>
  <div>
    <SetHead
      eyebrow="sync · cli"
      title="Sync"
      desc="Control how the markpost CLI writes records into your vault. These settings travel with your account and apply on every machine."
    />

    <div class="card card-pad">
      <div class="col gap-4">
        <AppField num="01" label="Vault directory" msg="absolute or ~-relative path on the synced machine">
          <div class="input-wrap">
            <span class="lead-addon"><AppIcon name="folder" :size="16" /></span>
            <input
              v-model="vaultDir"
              class="input has-lead mono"
              style="font-size: 13.5px"
            />
          </div>
        </AppField>
        <AppField num="02" label="Filename template" state="ok" msg="renders → 2026-06-14-production-deploy.md">
          <input v-model="filenameTemplate" class="input mono" style="font-size: 13.5px" />
        </AppField>
      </div>
    </div>

    <h3 class="h3" style="margin-top: 28px; margin-bottom: 4px">Behaviour</h3>
    <div class="card" style="margin-top: 14px; padding: 4px 22px">
      <div class="divide-y">
        <SetRow label="Auto-sync" hint="Run the watcher continuously and write records the moment they arrive.">
          <InputToggle v-model="autoSync" />
        </SetRow>
        <SetRow label="Auto-delete after sync" hint="Once a record is safely written to disk, remove the server-side copy. Your data stays only on your machine.">
          <div class="col" style="align-items: flex-end; gap: 8px">
            <InputToggle v-model="autoDelete" />
            <AppBadge v-if="autoDelete" tone="accent" style="font-size: 10px">local-only</AppBadge>
          </div>
        </SetRow>
        <SetRow label="Write YAML frontmatter" hint="Prepend title, source, tags and timestamps to each file.">
          <InputToggle v-model="frontmatter" />
        </SetRow>
        <SetRow label="On filename conflict" hint="What to do when a file already exists at the target path.">
          <InputSegmented
            v-model="conflictStrategy"
            :options="[
              { value: 'suffix', label: 'add suffix' },
              { value: 'overwrite', label: 'overwrite' },
              { value: 'skip', label: 'skip' },
            ]"
          />
        </SetRow>
      </div>
    </div>

    <div style="margin-top: 22px">
      <AppAlert tone="info" title="CLI tip">
        Changes here apply on the next <code>markpost sync</code>. Run
        <code>markpost config pull</code> to refresh a machine immediately.
      </AppAlert>
    </div>
    <div class="row gap-3" style="margin-top: 24px; justify-content: flex-end">
      <AppBtn variant="ghost">reset</AppBtn>
      <AppBtn variant="accent" icon="check">save sync settings</AppBtn>
    </div>
  </div>
</template>

<script setup lang="ts">
import SetHead from "./SetHead.vue";
import SetRow from "./SetRow.vue";

const autoSync = ref(true);
const autoDelete = ref(true);
const frontmatter = ref(true);
const conflictStrategy = ref("suffix");
const vaultDir = ref("~/Documents/Vault");
const filenameTemplate = ref("{{date}}-{{slug}}.md");
</script>
