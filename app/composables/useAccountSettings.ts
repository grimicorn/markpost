import { useUser } from "@clerk/nuxt";
import type { UserResource, SessionWithActivitiesResource } from "@clerk/types";

export type AccountSaveStatus = "idle" | "saving" | "saved" | "error";
export type AvatarUploadStatus = "idle" | "uploading" | "done" | "error";
export type TotpStatus = "idle" | "toggling" | "error";
export type SessionsStatus = "idle" | "loading" | "loaded" | "error";
export type DeleteStatus = "idle" | "deleting" | "error";

const AVATAR_MAX_BYTES = 1_048_576; // 1 MB
const ALLOWED_AVATAR_MIME_TYPES = ["image/png", "image/jpeg"] as const;

// Clerk's hosted security page handles 2FA enrollment (QR, verification, backup codes)
export const CLERK_SECURITY_URL = "https://accounts.clerk.dev/user/security";

export function useAccountSettings() {
  const { user, isLoaded } = useUser();

  // Profile fields — populated once Clerk loads
  const name = ref("");
  const email = ref("");
  const imageUrl = computed(() => user.value?.imageUrl ?? null);

  watch(
    () => user.value,
    (clerkUser) => {
      if (!clerkUser) {
        return;
      }
      name.value = clerkUser.fullName ?? "";
      email.value = clerkUser.primaryEmailAddress?.emailAddress ?? "";
    },
    { immediate: true },
  );

  // ── User accessor ─────────────────────────────────────────────────────────

  function getCurrentUser(): UserResource | null {
    return user.value ?? null;
  }

  // ── Profile save ──────────────────────────────────────────────────────────

  const saveStatus = ref<AccountSaveStatus>("idle");
  const saveError = ref<string | null>(null);

  async function saveProfile(clerkUser: UserResource): Promise<void> {
    const parts = name.value.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ");

    await clerkUser.update({ firstName, lastName });
  }

  async function saveChanges(): Promise<void> {
    const clerkUser = getCurrentUser();
    if (!clerkUser) {
      return;
    }

    if (!name.value.trim()) {
      saveError.value = "Full name is required.";
      saveStatus.value = "error";
      return;
    }

    saveStatus.value = "saving";
    saveError.value = null;

    try {
      await saveProfile(clerkUser);
      saveStatus.value = "saved";
    } catch (error) {
      saveError.value = extractErrorMessage(error);
      saveStatus.value = "error";
    }
  }

  function cancelChanges(): void {
    const clerkUser = getCurrentUser();
    if (!clerkUser) {
      return;
    }
    name.value = clerkUser.fullName ?? "";
    email.value = clerkUser.primaryEmailAddress?.emailAddress ?? "";
    saveStatus.value = "idle";
    saveError.value = null;
  }

  // Reset the "saved" banner when the user starts editing again
  watch(name, () => {
    if (saveStatus.value === "saved") {
      saveStatus.value = "idle";
    }
  });

  // ── Avatar upload ──────────────────────────────────────────────────────────

  const avatarUploadStatus = ref<AvatarUploadStatus>("idle");
  const avatarUploadError = ref<string | null>(null);

  async function uploadAvatar(file: File): Promise<void> {
    const clerkUser = getCurrentUser();
    if (!clerkUser) {
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      avatarUploadError.value = "Image must be 1 MB or smaller.";
      avatarUploadStatus.value = "error";
      return;
    }

    if (
      !ALLOWED_AVATAR_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_AVATAR_MIME_TYPES)[number],
      )
    ) {
      avatarUploadError.value = "Only PNG or JPG files are allowed.";
      avatarUploadStatus.value = "error";
      return;
    }

    avatarUploadStatus.value = "uploading";
    avatarUploadError.value = null;

    try {
      await clerkUser.setProfileImage({ file });
      avatarUploadStatus.value = "done";
    } catch (error) {
      avatarUploadError.value = extractErrorMessage(error);
      avatarUploadStatus.value = "error";
    }
  }

  function triggerAvatarPicker(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadAvatar(file);
      }
    };
    input.click();
  }

  // ── TOTP two-factor auth ───────────────────────────────────────────────────
  //
  // Enabling TOTP requires a multi-step flow (show QR → collect code → verify)
  // that lives in Clerk's hosted security page. The enable action navigates
  // there; only disabling is handled in-app since it needs no verification step.

  const twoFactor = computed(() => user.value?.twoFactorEnabled ?? false);
  const totpStatus = ref<TotpStatus>("idle");
  const totpError = ref<string | null>(null);

  function openClerkSecurityPage(): void {
    window.open(CLERK_SECURITY_URL, "_blank", "noopener,noreferrer");
  }

  async function disableTotp(): Promise<void> {
    const clerkUser = getCurrentUser();
    if (!clerkUser) {
      return;
    }

    totpStatus.value = "toggling";
    totpError.value = null;

    try {
      await clerkUser.disableTOTP();
      await clerkUser.reload();
      totpStatus.value = "idle";
    } catch (error) {
      totpError.value = extractErrorMessage(error);
      totpStatus.value = "error";
    }
  }

  async function toggleTwoFactor(): Promise<void> {
    if (twoFactor.value) {
      await disableTotp();
    } else {
      openClerkSecurityPage();
    }
  }

  // ── Active sessions ────────────────────────────────────────────────────────

  const sessions = ref<SessionWithActivitiesResource[]>([]);
  const sessionsStatus = ref<SessionsStatus>("idle");
  const sessionsError = ref<string | null>(null);

  async function loadSessions(): Promise<void> {
    const clerkUser = getCurrentUser();
    if (!clerkUser) {
      return;
    }

    sessionsStatus.value = "loading";
    sessionsError.value = null;

    try {
      sessions.value = await clerkUser.getSessions();
      sessionsStatus.value = "loaded";
    } catch (error) {
      sessionsError.value = extractErrorMessage(error);
      sessionsStatus.value = "error";
    }
  }

  const sessionCount = computed(() => sessions.value.length);

  // ── Delete account ─────────────────────────────────────────────────────────
  //
  // The server endpoint deletes all user data in a single DB transaction.
  // The client then calls clerkUser.delete() to remove the Clerk account and
  // end the active session. If the Clerk call fails after the DB step succeeds,
  // the account data is gone but the login survives — a recoverable state (the
  // user can still sign in and see an empty account). The error message shown
  // asks them to contact support rather than retrying blindly.

  const deleteStatus = ref<DeleteStatus>("idle");
  const deleteError = ref<string | null>(null);

  async function deleteAccount(): Promise<void> {
    const clerkUser = getCurrentUser();
    if (!clerkUser) {
      return;
    }

    deleteStatus.value = "deleting";
    deleteError.value = null;

    try {
      // Server-side DB cleanup; server does NOT delete the Clerk user
      await $fetch("/api/account", { method: "DELETE" });
      // Client removes the Clerk account — also ends the active session
      await clerkUser.delete();
    } catch (error) {
      deleteError.value = extractErrorMessage(error);
      deleteStatus.value = "error";
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function extractErrorMessage(error: unknown): string {
    if (!error || typeof error !== "object") {
      return "Something went wrong. Please try again.";
    }
    const fetchError = error as {
      data?: { message?: unknown };
      message?: unknown;
    };
    if (fetchError.data?.message) {
      return String(fetchError.data.message);
    }
    if (fetchError.message) {
      return String(fetchError.message);
    }
    return "Something went wrong. Please try again.";
  }

  return {
    // state
    isLoaded,
    name,
    email,
    imageUrl,
    twoFactor,
    sessions,
    sessionCount,
    // profile
    saveStatus,
    saveError,
    saveChanges,
    cancelChanges,
    // avatar
    avatarUploadStatus,
    avatarUploadError,
    triggerAvatarPicker,
    uploadAvatar,
    // totp
    totpStatus,
    totpError,
    toggleTwoFactor,
    // sessions
    sessionsStatus,
    sessionsError,
    loadSessions,
    // delete
    deleteStatus,
    deleteError,
    deleteAccount,
  };
}
