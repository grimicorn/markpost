<template>
  <TheAppShell active="sources" crumb="WORKSPACE / DAN'S VAULT" title="Sources">
    <template #actions>
      <AppBtn variant="accent" size="sm" icon="plus" @click="openModal"
        >add source</AppBtn
      >
    </template>

    <div style="padding: 22px 26px 40px; max-width: 920px">
      <div style="margin-bottom: 18px">
        <AppAlert tone="info" title="How sources work">
          There are only two ways in — a <strong>webhook endpoint</strong> and
          an <strong>email-in address</strong>. Presets like Stripe or GitHub
          are just a webhook with provider field-mapping baked in.
        </AppAlert>
      </div>

      <!-- transient error banners (add/remove failures — do not gate list) -->
      <AppAlert
        v-if="addError"
        tone="err"
        title="Failed to add source"
        :closeable="true"
        style="margin-bottom: 14px"
        @close="addError = null"
      >
        {{ addError }}
      </AppAlert>
      <AppAlert
        v-if="removeError"
        tone="err"
        title="Failed to remove source"
        :closeable="true"
        style="margin-bottom: 14px"
        @close="removeError = null"
      >
        {{ removeError }}
      </AppAlert>

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
        <span class="mono" style="font-size: 13px">loading sources…</span>
      </div>

      <!-- load error state (full-page, non-dismissable) -->
      <AppAlert
        v-else-if="loadError"
        tone="err"
        :title="LOAD_ERROR_TITLE"
        :closeable="false"
        style="margin-bottom: 18px"
      >
        {{ loadError }}
      </AppAlert>

      <!-- sources list -->
      <template v-else>
        <!-- empty state -->
        <div
          v-if="sources.length === 0"
          class="col"
          style="
            align-items: center;
            padding: 60px 0;
            color: var(--ink-3);
            gap: 12px;
            text-align: center;
          "
        >
          <AppIcon name="plug" :size="32" />
          <span style="font-size: 15px; font-weight: 500; color: var(--ink-2)"
            >No sources yet</span
          >
          <span class="mono" style="font-size: 13px">
            Add a webhook or email-in address to start routing records.
          </span>
          <AppBtn
            variant="accent"
            icon="plus"
            style="margin-top: 8px"
            @click="openModal"
          >
            add source
          </AppBtn>
        </div>

        <div v-else class="col gap-4">
          <SourceCard
            v-for="source in sources"
            :key="source.attributes.uuid"
            :source="source"
            @remove="onRemoveRequested"
          />

          <button
            class="card"
            style="
              padding: 20px;
              border: 1px dashed var(--line-2);
              background: transparent;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              color: var(--ink-2);
              font-family: var(--mono);
              font-size: 13px;
            "
            @click="openModal"
          >
            <AppIcon name="plus" :size="16" />connect another source
          </button>
        </div>
      </template>
    </div>

    <AddSourceModal
      v-if="modalState"
      :modal-state="modalState"
      @close="modalState = null"
      @pick="pickSource"
      @add="addSource"
    />

    <ConfirmDialog
      v-if="pendingRemoveUuid"
      :title="REMOVE_CONFIRM_TITLE"
      :message="REMOVE_CONFIRM_MESSAGE"
      confirm-label="remove"
      @confirm="confirmRemove"
      @cancel="cancelRemove"
    />
  </TheAppShell>
</template>

<script setup lang="ts">
import { useSources } from "~/composables/useSources";

definePageMeta({ middleware: "auth" });

const LOAD_ERROR_TITLE = "Failed to load sources";
const REMOVE_CONFIRM_TITLE = "Remove source?";
const REMOVE_CONFIRM_MESSAGE =
  "This will permanently delete the source and its endpoint. Records already ingested are not affected.";

const DEFAULT_ROUTE_FOLDER = "99-incoming/";

interface SourceChoice {
  id: string;
  name: string;
  via?: string;
  map?: string;
  ic?: string;
}

interface ModalState {
  step: "pick" | "config";
  choice: SourceChoice | null;
  folder: string;
}

const {
  sources,
  isLoading,
  loadSources,
  removeSource,
  addSource: addSourceToList,
} = useSources();

const modalState = ref<ModalState | null>(null);
const pendingRemoveUuid = ref<string | null>(null);
const loadError = ref<string | null>(null);
const addError = ref<string | null>(null);
const removeError = ref<string | null>(null);

onMounted(fetchInitialSources);

async function fetchInitialSources(): Promise<void> {
  try {
    await loadSources();
  } catch (fetchError) {
    console.error("[sources] fetchInitialSources error:", fetchError);
    loadError.value = "Failed to load sources. Please try again.";
  }
}

const openModal = () => {
  modalState.value = {
    step: "pick",
    choice: null,
    folder: DEFAULT_ROUTE_FOLDER,
  };
};

const pickSource = (choice: SourceChoice) => {
  modalState.value = {
    step: "config",
    choice,
    folder: DEFAULT_ROUTE_FOLDER,
  };
};

const addSource = async (folder: string) => {
  if (!modalState.value?.choice) {
    return;
  }

  const choice = modalState.value.choice;
  addError.value = null;

  try {
    await addSourceToList({
      type: choice.id,
      name: choice.name,
      routeFolder: folder,
    });
    modalState.value = null;
  } catch (createError) {
    console.error("[sources] addSource error:", createError);
    addError.value = "Failed to add source. Please try again.";
  }
};

const onRemoveRequested = (uuid: string) => {
  pendingRemoveUuid.value = uuid;
};

const confirmRemove = async () => {
  if (!pendingRemoveUuid.value) {
    return;
  }

  const uuid = pendingRemoveUuid.value;
  pendingRemoveUuid.value = null;
  removeError.value = null;

  try {
    await removeSource(uuid);
  } catch (deleteError) {
    console.error("[sources] confirmRemove error:", deleteError);
    removeError.value = "Failed to remove source. Please try again.";
  }
};

const cancelRemove = () => {
  pendingRemoveUuid.value = null;
};
</script>
