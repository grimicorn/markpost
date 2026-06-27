import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed, watch } from "vue";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSetProfileImage = vi.fn();
const mockCreateTOTP = vi.fn();
const mockDisableTOTP = vi.fn();
const mockReload = vi.fn();
const mockGetSessions = vi.fn();
const mockUserDelete = vi.fn();
const mockFetch = vi.fn();

vi.stubGlobal("$fetch", mockFetch);
vi.stubGlobal("navigateTo", vi.fn());

const mockUserRef = ref<ReturnType<typeof makeMockUser> | null>(null);

vi.mock("@clerk/nuxt", () => ({
  useUser: () => ({ user: mockUserRef, isLoaded: computed(() => true) }),
}));

function makeMockUser(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Dan Holloran",
    firstName: "Dan",
    lastName: "Holloran",
    primaryEmailAddress: { emailAddress: "dan@markpost.io" },
    twoFactorEnabled: false,
    imageUrl: null,
    update: mockUpdate,
    setProfileImage: mockSetProfileImage,
    createTOTP: mockCreateTOTP,
    disableTOTP: mockDisableTOTP,
    reload: mockReload,
    getSessions: mockGetSessions,
    delete: mockUserDelete,
    ...overrides,
  };
}

// Import AFTER mocks are registered
const { useAccountSettings } =
  await import("../../app/composables/useAccountSettings");

// ── Helpers ────────────────────────────────────────────────────────────────

function setup(userOverrides: Record<string, unknown> = {}) {
  mockUserRef.value = makeMockUser(userOverrides);

  // Manually trigger the watch callback since watch is a real Vue watch here
  const composable = useAccountSettings();
  // Seed the reactive fields the way the composable's watch would
  if (mockUserRef.value) {
    composable.name.value = mockUserRef.value.fullName as string;
    composable.email.value = (
      mockUserRef.value.primaryEmailAddress as { emailAddress: string }
    ).emailAddress;
  }
  return composable;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useAccountSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRef.value = null;
  });

  describe("saveChanges", () => {
    it("calls user.update with split first/last name and sets status to saved", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const { name, saveChanges, saveStatus } = setup();
      name.value = "Alice Smith";

      await saveChanges();

      expect(mockUpdate).toHaveBeenCalledWith({
        firstName: "Alice",
        lastName: "Smith",
      });
      expect(saveStatus.value).toBe("saved");
    });

    it("handles single-word name (no last name)", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const { name, saveChanges } = setup();
      name.value = "Alice";

      await saveChanges();

      expect(mockUpdate).toHaveBeenCalledWith({
        firstName: "Alice",
        lastName: "",
      });
    });

    it("sets saveStatus to error when update throws", async () => {
      mockUpdate.mockRejectedValue(new Error("update failed"));
      const { saveChanges, saveStatus, saveError } = setup();

      await saveChanges();

      expect(saveStatus.value).toBe("error");
      expect(saveError.value).toBe("update failed");
    });

    it("does nothing when user is null", async () => {
      mockUserRef.value = null;
      const { saveChanges } = useAccountSettings();
      await saveChanges();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("rejects empty name with an error and does not call update", async () => {
      const { name, saveChanges, saveStatus, saveError } = setup();
      name.value = "   ";

      await saveChanges();

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(saveStatus.value).toBe("error");
      expect(saveError.value).toMatch(/required/i);
    });
  });

  describe("cancelChanges", () => {
    it("resets name and email back to Clerk values", () => {
      const { name, email, cancelChanges } = setup({
        fullName: "Dan Holloran",
        primaryEmailAddress: { emailAddress: "dan@markpost.io" },
      });
      name.value = "Changed Name";
      cancelChanges();
      expect(name.value).toBe("Dan Holloran");
      expect(email.value).toBe("dan@markpost.io");
    });

    it("resets saveStatus to idle", async () => {
      mockUpdate.mockRejectedValue(new Error("fail"));
      const { saveChanges, cancelChanges, saveStatus } = setup();
      await saveChanges();
      expect(saveStatus.value).toBe("error");
      cancelChanges();
      expect(saveStatus.value).toBe("idle");
    });
  });

  describe("uploadAvatar", () => {
    it("calls user.setProfileImage with the file", async () => {
      mockSetProfileImage.mockResolvedValue(undefined);
      const { uploadAvatar, avatarUploadStatus } = setup();
      const file = new File(["bytes"], "avatar.png", { type: "image/png" });

      await uploadAvatar(file);

      expect(mockSetProfileImage).toHaveBeenCalledWith({ file });
      expect(avatarUploadStatus.value).toBe("done");
    });

    it("rejects files larger than 1 MB", async () => {
      const { uploadAvatar, avatarUploadStatus, avatarUploadError } = setup();
      const bigFile = new File([new Uint8Array(1_100_000)], "big.png", {
        type: "image/png",
      });

      await uploadAvatar(bigFile);

      expect(mockSetProfileImage).not.toHaveBeenCalled();
      expect(avatarUploadStatus.value).toBe("error");
      expect(avatarUploadError.value).toMatch(/1 MB/);
    });

    it("rejects files with a disallowed MIME type", async () => {
      const { uploadAvatar, avatarUploadStatus, avatarUploadError } = setup();
      const gifFile = new File(["gif data"], "anim.gif", {
        type: "image/gif",
      });

      await uploadAvatar(gifFile);

      expect(mockSetProfileImage).not.toHaveBeenCalled();
      expect(avatarUploadStatus.value).toBe("error");
      expect(avatarUploadError.value).toMatch(/PNG or JPG/);
    });

    it("sets status to error when setProfileImage throws", async () => {
      mockSetProfileImage.mockRejectedValue(new Error("upload error"));
      const { uploadAvatar, avatarUploadStatus } = setup();
      const file = new File(["x"], "a.png", { type: "image/png" });

      await uploadAvatar(file);

      expect(avatarUploadStatus.value).toBe("error");
    });
  });

  describe("toggleTwoFactor (enable)", () => {
    it("opens the Clerk security page when 2FA is disabled — does not call createTOTP", async () => {
      const mockWindowOpen = vi.fn();
      vi.stubGlobal("window", { open: mockWindowOpen });

      mockUserRef.value = makeMockUser({ twoFactorEnabled: false });
      const { toggleTwoFactor, totpStatus } = useAccountSettings();
      await toggleTwoFactor();

      expect(mockCreateTOTP).not.toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining("accounts.clerk.dev"),
        "_blank",
        expect.any(String),
      );
      // Status stays idle — the enable flow is handled by Clerk's hosted page
      expect(totpStatus.value).toBe("idle");
    });
  });

  describe("toggleTwoFactor (disable)", () => {
    it("calls disableTOTP and reloads when 2FA is already enabled", async () => {
      mockDisableTOTP.mockResolvedValue(undefined);
      mockReload.mockResolvedValue(undefined);
      mockUserRef.value = makeMockUser({ twoFactorEnabled: true });

      const { toggleTwoFactor, totpStatus } = useAccountSettings();
      await toggleTwoFactor();

      expect(mockDisableTOTP).toHaveBeenCalled();
      expect(mockReload).toHaveBeenCalled();
      expect(totpStatus.value).toBe("idle");
    });
  });

  describe("loadSessions", () => {
    it("fetches sessions and populates the sessions list", async () => {
      const fakeSessions = [{ id: "sess_1", status: "active" }];
      mockGetSessions.mockResolvedValue(fakeSessions);

      const { loadSessions, sessions, sessionsStatus } = setup();
      await loadSessions();

      expect(sessions.value).toEqual(fakeSessions);
      expect(sessionsStatus.value).toBe("loaded");
    });

    it("sets sessionsError when getSessions throws", async () => {
      mockGetSessions.mockRejectedValue(new Error("sessions error"));
      const { loadSessions, sessionsStatus, sessionsError } = setup();

      await loadSessions();

      expect(sessionsStatus.value).toBe("error");
      expect(sessionsError.value).toBe("sessions error");
    });
  });

  describe("sessionCount", () => {
    it("reflects the number of loaded sessions", async () => {
      mockGetSessions.mockResolvedValue([{ id: "a" }, { id: "b" }]);
      const { loadSessions, sessionCount } = setup();
      await loadSessions();
      expect(sessionCount.value).toBe(2);
    });
  });

  describe("deleteAccount", () => {
    it("calls the DELETE /api/account endpoint then user.delete", async () => {
      mockFetch.mockResolvedValue({ meta: { deleted: true } });
      mockUserDelete.mockResolvedValue(undefined);
      const { deleteAccount, deleteStatus } = setup();

      await deleteAccount();

      expect(mockFetch).toHaveBeenCalledWith("/api/account", {
        method: "DELETE",
      });
      expect(mockUserDelete).toHaveBeenCalled();
      // After success the account is gone — status stays "deleting" since the
      // component navigates away and there is no "idle" state to return to.
      expect(deleteStatus.value).toBe("deleting");
    });

    it("sets deleteError when server endpoint throws", async () => {
      mockFetch.mockRejectedValue(new Error("server error"));
      const { deleteAccount, deleteStatus, deleteError } = setup();

      await deleteAccount();

      expect(deleteStatus.value).toBe("error");
      expect(deleteError.value).toBe("server error");
      expect(mockUserDelete).not.toHaveBeenCalled();
    });

    it("does nothing when user is null", async () => {
      mockUserRef.value = null;
      const { deleteAccount } = useAccountSettings();
      await deleteAccount();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
