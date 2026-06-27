<template>
  <div>
    <SetHead
      eyebrow="account"
      title="Account"
      desc="Manage how you sign in and how your name appears across markpost."
    />

    <!-- Profile card -->
    <div class="card card-pad">
      <!-- Avatar row -->
      <div class="row gap-4" style="margin-bottom: 22px">
        <span
          v-if="!imageUrl"
          style="
            width: 56px;
            height: 56px;
            border-radius: 12px;
            background: var(--accent-tint);
            color: var(--accent-700);
            display: grid;
            place-items: center;
            font-family: var(--mono);
            font-size: 22px;
            font-weight: 600;
            flex: none;
          "
          aria-hidden="true"
        >
          {{ userInitial }}
        </span>
        <img
          v-else
          :src="imageUrl"
          :alt="`${name}'s avatar`"
          style="
            width: 56px;
            height: 56px;
            border-radius: 12px;
            object-fit: cover;
            flex: none;
          "
        />
        <div class="col gap-2">
          <AppBtn
            size="sm"
            :disabled="avatarUploadStatus === 'uploading'"
            @click="triggerAvatarPicker"
          >
            {{
              avatarUploadStatus === "uploading"
                ? "uploading…"
                : "upload avatar"
            }}
          </AppBtn>
          <span class="mono faint" style="font-size: 11px">
            PNG or JPG · max 1 MB
          </span>
          <span
            v-if="avatarUploadStatus === 'done'"
            class="mono"
            style="font-size: 11px; color: var(--ok)"
          >
            Avatar updated.
          </span>
          <span
            v-if="avatarUploadStatus === 'error'"
            class="mono"
            style="font-size: 11px; color: var(--err)"
          >
            {{ avatarUploadError }}
          </span>
        </div>
      </div>

      <!-- Name + email inputs -->
      <div class="col gap-4">
        <InputText v-model="name" num="01" label="Full name" />
        <InputText
          :model-value="email"
          num="02"
          label="Email"
          state="ok"
          msg="verified"
          lead-icon="at"
          type="email"
          :disabled="true"
        />
      </div>
    </div>

    <!-- Security section -->
    <h3 class="h3" style="margin-top: 30px; margin-bottom: 4px">Security</h3>
    <div class="card" style="margin-top: 14px; padding: 4px 22px">
      <div class="divide-y">
        <SetRow label="Password" hint="Change your account password via Clerk.">
          <AppBtn size="sm" icon="lock" :href="CLERK_SECURITY_URL" as="a">
            change
          </AppBtn>
        </SetRow>

        <SetRow label="Two-factor auth" hint="Require a code at sign-in.">
          <div class="col" style="align-items: flex-end; gap: 6px">
            <InputToggle
              :model-value="twoFactor"
              :disabled="totpStatus === 'toggling'"
              @update:model-value="toggleTwoFactor"
            />
            <span
              v-if="totpStatus === 'error'"
              class="mono"
              style="font-size: 11px; color: var(--err)"
            >
              {{ totpError }}
            </span>
          </div>
        </SetRow>

        <SetRow label="Active sessions" :hint="sessionsHint">
          <AppBtn
            size="sm"
            :disabled="sessionsStatus === 'loading'"
            @click="loadSessions"
          >
            {{ sessionsStatus === "loading" ? "loading…" : "manage" }}
          </AppBtn>
        </SetRow>
      </div>
    </div>

    <!-- Sessions list (shown after "manage" is clicked) -->
    <div
      v-if="sessionsStatus === 'loaded' && sessions.length > 0"
      class="card"
      style="margin-top: 10px; padding: 4px 22px"
    >
      <div class="divide-y">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="row between"
          style="padding: 14px 0"
        >
          <div class="col" style="gap: 2px">
            <span style="font-size: 13.5px; font-weight: 500">
              {{ session.latestActivity?.deviceType ?? "Unknown device" }}
            </span>
            <span class="mono faint" style="font-size: 11px">
              {{ session.latestActivity?.city ?? "" }}
              {{ session.latestActivity?.country ?? "" }}
            </span>
          </div>
          <AppBadge
            v-if="session.status === 'active'"
            tone="accent"
            style="font-size: 10px"
          >
            current
          </AppBadge>
        </div>
      </div>
    </div>
    <div v-if="sessionsStatus === 'error'" style="margin-top: 10px">
      <AppAlert tone="err">{{ sessionsError }}</AppAlert>
    </div>

    <!-- Danger zone -->
    <h3
      class="h3"
      style="margin-top: 30px; margin-bottom: 4px; color: var(--err)"
    >
      Danger zone
    </h3>
    <div
      class="card"
      style="
        margin-top: 14px;
        padding: 4px 22px;
        border-color: color-mix(in oklab, var(--err) 26%, var(--line));
      "
    >
      <SetRow
        label="Delete account"
        hint="Permanently remove your account and all server-side records. Files already on your disk are untouched."
      >
        <AppBtn
          size="sm"
          icon="trash"
          :style="{
            color: 'var(--err)',
            borderColor: 'color-mix(in oklab, var(--err) 40%, var(--line))',
          }"
          @click="showDeleteModal = true"
        >
          delete
        </AppBtn>
      </SetRow>
    </div>

    <!-- Save / cancel row -->
    <div v-if="saveStatus === 'error' && saveError" style="margin-top: 16px">
      <AppAlert tone="err">{{ saveError }}</AppAlert>
    </div>
    <div v-if="saveStatus === 'saved'" style="margin-top: 16px">
      <AppAlert tone="ok">Profile saved.</AppAlert>
    </div>

    <div class="row gap-3" style="margin-top: 24px; justify-content: flex-end">
      <AppBtn
        variant="ghost"
        :disabled="saveStatus === 'saving'"
        @click="cancelChanges"
      >
        cancel
      </AppBtn>
      <AppBtn
        variant="accent"
        icon="check"
        :disabled="saveStatus === 'saving'"
        @click="saveChanges"
      >
        {{ saveStatus === "saving" ? "saving…" : "save changes" }}
      </AppBtn>
    </div>

    <!-- Delete confirmation modal -->
    <DeleteAccountModal
      :open="showDeleteModal"
      :deleting="deleteStatus === 'deleting'"
      :error="deleteError"
      @confirm="handleDeleteConfirm"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import SetHead from "./SetHead.vue";
import SetRow from "./SetRow.vue";
import DeleteAccountModal from "./DeleteAccountModal.vue";
import {
  useAccountSettings,
  CLERK_SECURITY_URL,
} from "../../composables/useAccountSettings";

const {
  name,
  email,
  imageUrl,
  twoFactor,
  sessions,
  sessionCount,
  saveStatus,
  saveError,
  saveChanges,
  cancelChanges,
  avatarUploadStatus,
  avatarUploadError,
  triggerAvatarPicker,
  totpStatus,
  totpError,
  toggleTwoFactor,
  sessionsStatus,
  sessionsError,
  loadSessions,
  deleteStatus,
  deleteError,
  deleteAccount,
} = useAccountSettings();

const showDeleteModal = ref(false);

const userInitial = computed(() => {
  const firstChar = name.value?.[0] ?? email.value?.[0] ?? "U";
  return firstChar.toUpperCase();
});

const sessionsHint = computed(() => {
  if (sessionsStatus.value === "loaded") {
    return `${sessionCount.value} device${sessionCount.value === 1 ? "" : "s"} currently signed in.`;
  }
  return "View devices currently signed in to your account.";
});

async function handleDeleteConfirm(): Promise<void> {
  await deleteAccount();
  if (deleteStatus.value !== "error") {
    showDeleteModal.value = false;
    await navigateTo("/");
  }
}
</script>
