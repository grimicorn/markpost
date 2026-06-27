<template>
  <div>
    <SetHead
      eyebrow="sync · cli"
      title="Sync"
      desc="Control how the markpost CLI writes records into your vault. These settings travel with your account and apply on every machine."
    />

    <div v-if="loadError" style="margin-bottom: 16px">
      <AppAlert tone="err" title="Load error">
        {{ loadError }}
        <AppBtn
          variant="ghost"
          size="sm"
          style="margin-top: 8px"
          :disabled="isLoading"
          @click="load"
        >
          retry
        </AppBtn>
      </AppAlert>
    </div>

    <div class="card card-pad">
      <div class="col gap-4">
        <AppField
          num="01"
          label="Vault directory"
          msg="absolute or ~-relative path on the synced machine"
        >
          <div class="input-wrap">
            <span class="lead-addon"><AppIcon name="folder" :size="16" /></span>
            <input
              v-model="current.vaultDir"
              class="input has-lead mono"
              style="font-size: 13.5px"
              :disabled="isInputDisabled"
            />
          </div>
        </AppField>
        <AppField
          num="02"
          label="Filename template"
          state="ok"
          msg="renders → 2026-06-14-production-deploy.md"
        >
          <input
            v-model="current.filenameTemplate"
            class="input mono"
            style="font-size: 13.5px"
            :disabled="isInputDisabled"
          />
        </AppField>
      </div>
    </div>

    <h3 class="h3" style="margin-top: 28px; margin-bottom: 4px">Behaviour</h3>
    <div class="card" style="margin-top: 14px; padding: 4px 22px">
      <div class="divide-y">
        <SetRow
          label="Auto-sync"
          hint="Run the watcher continuously and write records the moment they arrive."
        >
          <InputToggle v-model="current.autoSync" :disabled="isInputDisabled" />
        </SetRow>
        <SetRow
          label="Auto-delete after sync"
          hint="Once a record is safely written to disk, remove the server-side copy. Your data stays only on your machine."
        >
          <div class="col" style="align-items: flex-end; gap: 8px">
            <InputToggle
              v-model="current.autoDelete"
              :disabled="isInputDisabled"
            />
            <AppBadge
              v-if="current.autoDelete"
              tone="accent"
              style="font-size: 10px"
              >local-only</AppBadge
            >
          </div>
        </SetRow>
        <SetRow
          label="Write YAML frontmatter"
          hint="Prepend title, source, tags and timestamps to each file."
        >
          <InputToggle
            v-model="current.frontmatter"
            :disabled="isInputDisabled"
          />
        </SetRow>
        <SetRow
          label="On filename conflict"
          hint="What to do when a file already exists at the target path."
        >
          <InputSegmented
            v-model="current.conflictStrategy"
            :options="CONFLICT_STRATEGY_OPTIONS"
            :disabled="isInputDisabled"
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

    <div v-if="saveError" style="margin-top: 12px">
      <AppAlert tone="err" title="Save error">{{ saveError }}</AppAlert>
    </div>

    <div v-if="saveSuccess" style="margin-top: 12px">
      <AppAlert tone="ok" title="Saved">Sync settings saved.</AppAlert>
    </div>

    <div class="row gap-3" style="margin-top: 24px; justify-content: flex-end">
      <AppBtn variant="ghost" :disabled="isInputDisabled" @click="reset">
        reset
      </AppBtn>
      <AppBtn
        variant="accent"
        icon="check"
        :disabled="isInputDisabled"
        @click="save"
      >
        {{ isSaving ? "saving…" : "save sync settings" }}
      </AppBtn>
    </div>
  </div>
</template>

<script setup lang="ts">
import SetHead from "./SetHead.vue";
import SetRow from "./SetRow.vue";
import type { ConflictStrategy } from "~/composables/useSyncSettings";

const CONFLICT_STRATEGY_OPTIONS: { value: ConflictStrategy; label: string }[] =
  [
    { value: "suffix", label: "add suffix" },
    { value: "overwrite", label: "overwrite" },
    { value: "skip", label: "skip" },
  ];

const {
  current,
  hasSaved,
  isLoading,
  isSaving,
  loadError,
  saveError,
  saveSuccess,
  load,
  save,
  reset,
} = useSyncSettings();

const isInputDisabled = computed(
  () => isLoading.value || isSaving.value || !hasSaved.value,
);

onMounted(() => {
  load();
});
</script>
