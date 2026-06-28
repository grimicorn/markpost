<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      tabindex="-1"
      @click.self="!deleting && emit('cancel')"
      @keydown.esc="!deleting && emit('cancel')"
    >
      <div class="card" style="width: 440px; padding: 28px 28px 24px">
        <h2
          id="delete-modal-title"
          style="
            font-size: 17px;
            font-weight: 600;
            color: var(--err);
            margin-bottom: 10px;
          "
        >
          Delete account?
        </h2>
        <p style="font-size: 14px; line-height: 1.55; color: var(--ink-2)">
          This permanently removes your account and all server-side records
          (inbox items, sources, settings). Files already on your disk are
          untouched. This action cannot be undone.
        </p>

        <div v-if="error" style="margin-top: 16px">
          <AppAlert tone="err">{{ error }}</AppAlert>
        </div>

        <div
          class="row gap-3"
          style="margin-top: 24px; justify-content: flex-end"
        >
          <AppBtn variant="ghost" :disabled="deleting" @click="emit('cancel')">
            cancel
          </AppBtn>
          <AppBtn
            :disabled="deleting"
            :style="{
              color: 'var(--err)',
              borderColor: 'color-mix(in oklab, var(--err) 40%, var(--line))',
            }"
            icon="trash"
            @click="emit('confirm')"
          >
            {{ deleting ? "deleting…" : "yes, delete my account" }}
          </AppBtn>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  deleting: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: color-mix(in oklab, var(--bg) 60%, transparent);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 100;
}
</style>
