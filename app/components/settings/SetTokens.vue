<template>
  <div>
    <SetHead
      eyebrow="api · access"
      title="API Tokens"
      desc="Tokens authenticate the markpost CLI and direct API calls. Treat them like passwords — they carry full access to your records."
    />

    <div v-if="revealedToken" style="margin-bottom: 18px">
      <AppAlert
        tone="warn"
        title="Copy your new token now"
        :closeable="true"
        @close="clearRevealedToken"
      >
        For your security it won't be shown again.
        <div class="code" style="margin-top: 10px">
          <div class="code-head">
            <span class="lang">token</span>
            <AppCopyBtn :text="revealedToken" />
          </div>
          <div
            class="code-body mono"
            style="font-size: 12.5px; word-break: break-all"
          >
            {{ revealedToken }}
          </div>
        </div>
      </AppAlert>
    </div>

    <div v-if="loadError" style="margin-bottom: 16px">
      <AppAlert tone="err" title="Load error">
        {{ loadError }}
        <AppBtn
          variant="ghost"
          size="sm"
          style="margin-top: 8px"
          :disabled="isLoading"
          @click="loadTokens"
        >
          retry
        </AppBtn>
      </AppAlert>
    </div>

    <div v-if="mintError" style="margin-bottom: 16px">
      <AppAlert tone="err" title="Failed to generate token">
        {{ mintError }}
      </AppAlert>
    </div>

    <div v-if="revokeError" style="margin-bottom: 16px">
      <AppAlert tone="err" title="Failed to revoke token">
        {{ revokeError }}
      </AppAlert>
    </div>

    <div v-if="isGenerating" class="card card-pad" style="margin-bottom: 16px">
      <div class="col gap-3">
        <label class="col gap-2">
          <span style="font-size: 13px; font-weight: 500">Token name</span>
          <input
            v-model="pendingTokenName"
            class="input"
            placeholder="e.g. obsidian-laptop"
            :disabled="isMinting"
            @keydown.enter="confirmGenerate"
            @keydown.escape="cancelGenerate"
          />
        </label>
        <div class="row gap-3">
          <AppBtn
            variant="accent"
            size="sm"
            icon="check"
            :disabled="!pendingTokenName.trim() || isMinting"
            @click="confirmGenerate"
          >
            {{ isMinting ? "generating…" : "generate" }}
          </AppBtn>
          <AppBtn
            variant="ghost"
            size="sm"
            :disabled="isMinting"
            @click="cancelGenerate"
          >
            cancel
          </AppBtn>
        </div>
      </div>
    </div>

    <div class="row between" style="margin-bottom: 14px">
      <span class="kicker">
        <template v-if="isLoading">loading…</template>
        <template v-else>{{ tokens.length }} active tokens</template>
      </span>
      <AppBtn
        size="sm"
        variant="accent"
        icon="plus"
        :disabled="isGenerating || isMinting"
        @click="startGenerate"
        >generate token</AppBtn
      >
    </div>

    <div class="card" style="overflow: hidden">
      <div class="divide-y">
        <div
          v-for="token in tokens"
          :key="token.id"
          class="row between"
          style="padding: 15px 20px; gap: 16px"
        >
          <div class="row gap-3" style="min-width: 0">
            <span
              style="
                width: 34px;
                height: 34px;
                border-radius: 8px;
                border: 1px solid var(--line-2);
                display: grid;
                place-items: center;
                color: var(--ink-2);
                flex: none;
              "
            >
              <AppIcon name="key" :size="16" />
            </span>
            <div class="col" style="gap: 3px; min-width: 0">
              <span style="font-weight: 500; font-size: 14px">{{
                token.name
              }}</span>
              <span class="mono faint" style="font-size: 11.5px">
                {{ token.prefix }}•••••••••••• · created
                {{ formatDate(token.createdAt) }} · used
                {{ formatDate(token.lastUsedAt) }}
              </span>
            </div>
          </div>
          <button
            class="icon-btn"
            style="color: var(--err)"
            title="revoke"
            :disabled="isRevoking"
            @click="revokeToken(token.id)"
          >
            <AppIcon name="trash" :size="16" />
          </button>
        </div>
      </div>
    </div>

    <h3 class="h3" style="margin-top: 30px">Use it</h3>
    <div class="code" style="margin-top: 14px">
      <div class="code-head">
        <span class="lang">bash</span>
        <AppCopyBtn
          text="curl -H 'Authorization: Bearer mp_live_…' https://ingest.markpost.io/v1/records"
        />
      </div>
      <div class="code-body" style="white-space: pre">
        <span class="c"># authenticate the CLI</span>
        <span class="k">markpost</span> auth
        <span class="s">mp_live_8f2a…</span>

        <span class="c"># or call the API directly</span>
        <span class="k">curl</span> -H
        <span class="s">"Authorization: Bearer mp_live_…"</span> \
        https://ingest.markpost.io/v1/records
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SetHead from "./SetHead.vue";

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
};

function formatDate(date: Date | null): string {
  if (!date) {
    return "never";
  }
  return date.toLocaleDateString("en-US", DATE_FORMAT_OPTIONS);
}

const {
  tokens,
  isLoading,
  loadError,
  isMinting,
  mintError,
  isRevoking,
  revokeError,
  revealedToken,
  loadTokens,
  mintToken,
  revokeToken,
  clearRevealedToken,
} = useApiTokens();

const isGenerating = ref(false);
const pendingTokenName = ref("");

function startGenerate() {
  isGenerating.value = true;
  pendingTokenName.value = "";
}

function cancelGenerate() {
  isGenerating.value = false;
  pendingTokenName.value = "";
}

async function confirmGenerate() {
  const name = pendingTokenName.value.trim();

  if (!name) {
    return;
  }

  await mintToken(name);

  if (mintError.value) {
    return;
  }

  isGenerating.value = false;
  pendingTokenName.value = "";
}

onMounted(() => {
  loadTokens();
});
</script>
