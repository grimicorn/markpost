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

      <div class="col gap-4">
        <SourceCard
          v-for="source in sources"
          :key="source.id"
          :source="source"
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
    </div>

    <AddSourceModal
      v-if="modalState"
      :modal-state="modalState"
      @close="modalState = null"
      @pick="pickSource"
      @add="addSource"
    />
  </TheAppShell>
</template>

<script setup lang="ts">
import SourceCard from "~/components/SourceCard.vue";
import AddSourceModal from "~/components/AddSourceModal.vue";

definePageMeta({ middleware: "auth" });

interface SourceItem {
  id: string;
  ic?: string;
  letter?: string;
  name: string;
  sub: string;
  label: string;
  endpoint: string;
  endpointHighlight?: string;
  meta: string[];
  fresh?: boolean;
  via?: string;
}

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
  gen: string;
  folder: string;
}

const sources = ref<SourceItem[]>([
  {
    id: "wh1",
    ic: "zap",
    name: "Webhook endpoint",
    sub: "POST · any JSON payload",
    label: "ingest url",
    endpoint: "https://ingest.markpost.io/v1/hooks/wh_8f2a91c4",
    endpointHighlight: "wh_8f2a91c4",
    meta: ["142 records", "last hit 2m ago", "routes to 99-incoming/"],
  },
  {
    id: "em1",
    ic: "mail",
    name: "Email-in address",
    sub: "forward or send anything",
    label: "address",
    endpoint: "clip-8f2a@in.markpost.io",
    endpointHighlight: "clip-8f2a",
    meta: ["87 records", "last hit 14m ago", "strips tracking pixels"],
  },
]);

const modalState = ref<ModalState | null>(null);

const openModal = () => {
  modalState.value = {
    step: "pick",
    choice: null,
    gen: "",
    folder: "99-incoming/",
  };
};

const pickSource = (choice: SourceChoice) => {
  const generatedId = Math.random().toString(36).slice(2, 10);
  modalState.value = {
    step: "config",
    choice,
    gen: generatedId,
    folder: "99-incoming/",
  };
};

const addSource = (folder: string) => {
  if (!modalState.value?.choice) {
    return;
  }
  const { choice, gen } = modalState.value;

  let newSource: SourceItem;

  if (choice.id === "email") {
    newSource = {
      id: gen,
      ic: "mail",
      name: "Email-in address",
      sub: "forward or send anything",
      label: "address",
      fresh: true,
      endpoint: `clip-${gen.slice(0, 4)}@in.markpost.io`,
      endpointHighlight: `clip-${gen.slice(0, 4)}`,
      meta: ["0 records", "just added", `routes to ${folder}`],
    };
  } else if (choice.id === "webhook") {
    newSource = {
      id: gen,
      ic: "zap",
      name: "Webhook endpoint",
      sub: "POST · any JSON payload",
      label: "ingest url",
      fresh: true,
      endpoint: `https://ingest.markpost.io/v1/hooks/wh_${gen}`,
      endpointHighlight: `wh_${gen}`,
      meta: ["0 records", "just added", `routes to ${folder}`],
    };
  } else {
    newSource = {
      id: gen,
      letter: choice.name[0],
      name: choice.name,
      via: choice.via,
      sub: "maps " + choice.map,
      label: "ingest url",
      fresh: true,
      endpoint: `https://ingest.markpost.io/v1/hooks/${choice.id}_${gen}`,
      endpointHighlight: `${choice.id}_${gen}`,
      meta: ["0 records", "just added", `routes to ${folder}`],
    };
  }

  sources.value = [...sources.value, newSource];
  modalState.value = null;
};
</script>
