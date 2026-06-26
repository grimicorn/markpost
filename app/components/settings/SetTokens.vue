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
        @close="revealedToken = ''"
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

    <div class="row between" style="margin-bottom: 14px">
      <span class="kicker">{{ tokens.length }} active tokens</span>
      <AppBtn size="sm" variant="accent" icon="plus" @click="generateToken"
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
                {{ token.prefix }}•••••••••••• · created {{ token.created }} ·
                used {{ token.used }}
              </span>
            </div>
          </div>
          <button
            class="icon-btn"
            style="color: var(--err)"
            title="revoke"
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

interface Token {
  id: number;
  name: string;
  prefix: string;
  created: string;
  used: string;
}

const tokens = ref<Token[]>([
  {
    id: 1,
    name: "obsidian-laptop",
    prefix: "mp_live_8f2a",
    created: "Apr 02, 2026",
    used: "2m ago",
  },
  {
    id: 2,
    name: "home-server",
    prefix: "mp_live_2c71",
    created: "Mar 18, 2026",
    used: "yesterday",
  },
]);

const revealedToken = ref("");

const generateToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const token = `mp_live_${hex}`;
  revealedToken.value = token;
  tokens.value = [
    {
      id: Date.now(),
      name: "new-token",
      prefix: token.slice(0, 12),
      created: "just now",
      used: "never",
    },
    ...tokens.value,
  ];
};

const revokeToken = (id: number) => {
  tokens.value = tokens.value.filter((token) => token.id !== id);
};
</script>
