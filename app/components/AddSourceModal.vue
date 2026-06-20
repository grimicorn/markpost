<template>
  <div
    style="
      position: fixed;
      inset: 0;
      background: color-mix(in oklab, #000 46%, transparent);
      display: grid;
      place-items: center;
      z-index: 50;
      padding: 24px;
    "
    @click="emit('close')"
  >
    <div
      class="card"
      style="
        width: 600px;
        max-width: 100%;
        max-height: 90%;
        overflow: auto;
        box-shadow: var(--sh-pop);
      "
      @click.stop
    >
      <!-- head -->
      <div class="row between" style="padding: 18px 24px; border-bottom: 1px solid var(--line)">
        <div class="row gap-3" style="align-items: center">
          <button
            v-if="modalState.step === 'config'"
            class="icon-btn"
            @click="emit('close')"
          >
            <AppIcon name="chevR" :size="18" :style="{ transform: 'rotate(180deg)' }" />
          </button>
          <div class="col" style="gap: 2px">
            <span class="mono faint" style="font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase">
              {{ modalState.step === "pick" ? "step 1 / 2" : "step 2 / 2" }}
            </span>
            <h3 style="font-size: 17px; font-weight: 600">
              {{ modalState.step === "pick" ? "Add a source" : `Configure ${modalState.choice?.name}` }}
            </h3>
          </div>
        </div>
        <button class="icon-btn" @click="emit('close')">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <!-- step: pick -->
      <div v-if="modalState.step === 'pick'" style="padding: 24px">
        <span class="field-label" style="margin-bottom: 12px">two ways in</span>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
          <button
            v-for="prim in SOURCE_PRIMS"
            :key="prim.id"
            class="card"
            style="padding: 16px; text-align: left; cursor: pointer; background: var(--surface-2); display: block"
            @click="emit('pick', prim)"
            @mouseenter="($event.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'"
            @mouseleave="($event.currentTarget as HTMLElement).style.borderColor = 'var(--line)'"
          >
            <div class="row between">
              <span
                :style="{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--accent-tint)',
                  color: 'var(--accent-700)',
                  display: 'grid',
                  placeItems: 'center',
                }"
              >
                <AppIcon :name="prim.ic" :size="18" />
              </span>
              <AppIcon name="arrowR" :size="16" :style="{ color: 'var(--ink-3)' }" />
            </div>
            <div style="font-weight: 600; font-size: 14.5px; margin-top: 12px">{{ prim.name }}</div>
            <div class="muted" style="font-size: 12.5px; margin-top: 4px; line-height: 1.45">{{ prim.desc }}</div>
          </button>
        </div>

        <div class="row gap-3" style="align-items: center; margin: 22px 0 14px">
          <span class="field-label" style="margin: 0">presets</span>
          <span class="mono faint" style="font-size: 11px">— a webhook with mapping built in</span>
          <hr class="hairline grow" />
        </div>
        <div class="col gap-2">
          <button
            v-for="preset in SOURCE_PRESETS"
            :key="preset.id"
            class="row gap-3"
            style="
              width: 100%;
              text-align: left;
              cursor: pointer;
              border: 1px solid var(--line);
              border-radius: 9px;
              padding: 11px 14px;
              background: var(--surface-2);
              align-items: center;
            "
            @click="emit('pick', preset)"
            @mouseenter="($event.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'"
            @mouseleave="($event.currentTarget as HTMLElement).style.borderColor = 'var(--line)'"
          >
            <span
              :style="{
                width: '32px',
                height: '32px',
                borderRadius: '7px',
                background: 'var(--bg-2)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                fontSize: '14px',
                flex: 'none',
              }"
            >
              {{ preset.name[0] }}
            </span>
            <div class="col" style="gap: 1px; flex: 1; min-width: 0">
              <span style="font-weight: 500; font-size: 14px">{{ preset.name }}</span>
              <span class="muted" style="font-size: 12px">{{ preset.desc }}</span>
            </div>
            <AppChip style="font-size: 10px">via {{ preset.via }}</AppChip>
          </button>
        </div>
      </div>

      <!-- step: config -->
      <div v-if="modalState.step === 'config' && modalState.choice" style="padding: 24px">
        <div v-if="modalState.choice.via" style="margin-bottom: 16px">
          <AppAlert tone="info" title="This is a webhook preset">
            A <strong>{{ modalState.choice.name }}</strong> source is a webhook endpoint with
            {{ modalState.choice.name }} field-mapping{{
              modalState.choice.via === "webhook" ? " and signature verification" : ""
            }}
            applied automatically. You can edit the mapping any time.
          </AppAlert>
        </div>

        <span class="field-label" style="margin-bottom: 8px">
          {{
            modalState.choice.id === "email"
              ? "your address — share or forward to it"
              : `ingest url — point ${modalState.choice.name} here`
          }}
        </span>
        <div class="code">
          <div class="code-head">
            <span class="lang">{{ modalState.choice.id === "email" ? "address" : "endpoint" }}</span>
            <AppCopyBtn :text="configEndpoint" />
          </div>
          <div class="code-body mono" style="font-size: 12.5px; word-break: break-all">
            <template v-if="modalState.choice.id === 'email'">
              <span style="color: var(--accent-700)">clip-{{ modalState.gen.slice(0, 4) }}</span>@in.markpost.io
            </template>
            <template v-else>
              https://ingest.markpost.io/v1/hooks/<span style="color: var(--accent-700)">{{ configEndpointId }}_{{ modalState.gen }}</span>
            </template>
          </div>
        </div>

        <div v-if="modalState.choice.map" style="margin-top: 16px">
          <span class="field-label" style="margin-bottom: 8px">field mapping</span>
          <div class="row gap-2 wrap">
            <AppChip v-for="field in modalState.choice.map.split(' · ')" :key="field" accent>
              {{ field }}
            </AppChip>
          </div>
        </div>

        <div style="margin-top: 18px">
          <AppField num="01" label="Route records to" msg="folder inside your vault">
            <div class="input-wrap">
              <span class="lead-addon"><AppIcon name="folder" :size="16" /></span>
              <input
                v-model="folderInput"
                class="input has-lead mono"
                style="font-size: 13.5px"
              />
            </div>
          </AppField>
        </div>

        <div class="row gap-3" style="justify-content: flex-end; margin-top: 22px">
          <AppBtn variant="ghost" @click="emit('close')">back</AppBtn>
          <AppBtn variant="accent" icon="check" @click="emit('add', folderInput)">add source</AppBtn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SourceChoice {
  id: string;
  name: string;
  via?: string;
  map?: string;
  ic?: string;
  desc?: string;
  tag?: string;
}

interface ModalState {
  step: "pick" | "config";
  choice: SourceChoice | null;
  gen: string;
  folder: string;
}

const props = defineProps<{
  modalState: ModalState;
}>();

const emit = defineEmits<{
  close: [];
  pick: [choice: SourceChoice];
  add: [folder: string];
}>();

const folderInput = ref(props.modalState.folder);

const SOURCE_PRIMS: SourceChoice[] = [
  {
    id: "webhook",
    ic: "zap",
    name: "Webhook endpoint",
    desc: "POST any JSON to a unique URL. The raw building block every integration uses.",
    tag: "POST · JSON",
  },
  {
    id: "email",
    ic: "mail",
    name: "Email-in address",
    desc: "Forward or send mail to a unique address. Subject and body become a record.",
    tag: "forward · send",
  },
];

const SOURCE_PRESETS: SourceChoice[] = [
  { id: "stripe", name: "Stripe", desc: "Payments, invoices & subscription events.", map: "amount · customer · status", via: "webhook" },
  { id: "github", name: "GitHub", desc: "Pushes, issues, PRs & releases.", map: "repo · ref · title · body", via: "webhook" },
  { id: "zapier", name: "Zapier", desc: "Relay anything from 6,000+ apps.", map: "passthrough", via: "webhook" },
  { id: "rss", name: "RSS / Atom", desc: "Poll a feed and capture new items.", map: "title · link · content", via: "poll" },
  { id: "shortcuts", name: "Apple Shortcuts", desc: "Send text from iOS & macOS.", map: "title · text", via: "webhook" },
];

const configEndpointId = computed(() => {
  const choice = props.modalState.choice;
  if (!choice) {
    return "";
  }
  return choice.id === "webhook" ? "wh" : choice.id;
});

const configEndpoint = computed(() => {
  const choice = props.modalState.choice;
  if (!choice) {
    return "";
  }
  if (choice.id === "email") {
    return `clip-${props.modalState.gen.slice(0, 4)}@in.markpost.io`;
  }
  return `https://ingest.markpost.io/v1/hooks/${configEndpointId.value}_${props.modalState.gen}`;
});
</script>
