import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { ref, computed } from "vue";

// ── Mock the composable used by the component ──────────────────────────────

const mockSaveChanges = vi.fn();
const mockCancelChanges = vi.fn();
const mockTriggerAvatarPicker = vi.fn();
const mockToggleTwoFactor = vi.fn();
const mockLoadSessions = vi.fn();
const mockDeleteAccount = vi.fn();

const accountState = {
  name: ref("Dan Holloran"),
  email: ref("dan@markpost.io"),
  imageUrl: ref<string | null>(null),
  twoFactor: computed(() => false),
  sessions: ref<unknown[]>([]),
  sessionCount: computed(() => 0),
  saveStatus: ref<string>("idle"),
  saveError: ref<string | null>(null),
  saveChanges: mockSaveChanges,
  cancelChanges: mockCancelChanges,
  avatarUploadStatus: ref<string>("idle"),
  avatarUploadError: ref<string | null>(null),
  triggerAvatarPicker: mockTriggerAvatarPicker,
  uploadAvatar: vi.fn(),
  totpStatus: ref<string>("idle"),
  totpError: ref<string | null>(null),
  toggleTwoFactor: mockToggleTwoFactor,
  sessionsStatus: ref<string>("idle"),
  sessionsError: ref<string | null>(null),
  loadSessions: mockLoadSessions,
  deleteStatus: ref<string>("idle"),
  deleteError: ref<string | null>(null),
  deleteAccount: mockDeleteAccount,
  totpSecret: ref<string | null>(null),
  totpQrUri: ref<string | null>(null),
  verifyTotpCode: vi.fn(),
};

vi.mock("../../../app/composables/useAccountSettings", () => ({
  useAccountSettings: () => accountState,
  CLERK_SECURITY_URL: "https://accounts.clerk.dev/user/security",
}));

// navigateTo is a Nuxt global — stub it
vi.stubGlobal("navigateTo", vi.fn());

// Import AFTER mocks
import SetAccount from "../../../app/components/settings/SetAccount.vue";

// ── Stub child components ─────────────────────────────────────────────────

const globalConfig = {
  global: {
    stubs: {
      SetHead: { template: '<div class="set-head-stub" />' },
      SetRow: {
        template:
          '<div class="set-row-stub" :data-label="label"><slot /></div>',
        props: ["label", "hint"],
      },
      AppBtn: {
        template:
          '<button class="app-btn-stub" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        props: ["size", "variant", "icon", "disabled", "href", "as"],
        emits: ["click"],
      },
      InputText: {
        template:
          '<input class="input-text-stub" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        props: [
          "modelValue",
          "num",
          "label",
          "state",
          "msg",
          "leadIcon",
          "type",
          "disabled",
        ],
        emits: ["update:modelValue"],
      },
      InputToggle: {
        template:
          '<input type="checkbox" class="input-toggle-stub" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        props: ["modelValue", "disabled"],
        emits: ["update:modelValue"],
      },
      AppAlert: {
        template:
          '<div class="app-alert-stub" :data-tone="tone"><slot /></div>',
        props: ["tone"],
      },
      AppBadge: {
        template: '<span class="app-badge-stub"><slot /></span>',
        props: ["tone"],
      },
      AppIcon: { template: "<span />" },
      DeleteAccountModal: {
        template: '<div class="delete-modal-stub" :data-open="open" />',
        props: ["open", "deleting", "error"],
        emits: ["confirm", "cancel"],
      },
      Teleport: false,
    },
  },
};

function mountComponent(): VueWrapper {
  return mount(SetAccount, globalConfig);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SetAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountState.saveStatus.value = "idle";
    accountState.saveError.value = null;
    accountState.avatarUploadStatus.value = "idle";
    accountState.avatarUploadError.value = null;
    accountState.totpStatus.value = "idle";
    accountState.sessionsStatus.value = "idle";
    accountState.deleteStatus.value = "idle";
    accountState.deleteError.value = null;
    accountState.sessions.value = [];
    accountState.name.value = "Dan Holloran";
    accountState.email.value = "dan@markpost.io";
    accountState.imageUrl.value = null;
  });

  it("matches snapshot in idle state", () => {
    const wrapper = mountComponent();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows initials avatar when imageUrl is null", () => {
    accountState.imageUrl.value = null;
    const wrapper = mountComponent();
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find("span[aria-hidden]").text()).toBe("D");
  });

  it("shows avatar img when imageUrl is set", () => {
    accountState.imageUrl.value = "https://example.com/avatar.png";
    const wrapper = mountComponent();
    expect(wrapper.find("img").exists()).toBe(true);
    expect(wrapper.find("img").attributes("src")).toBe(
      "https://example.com/avatar.png",
    );
  });

  it("calls triggerAvatarPicker when upload avatar button is clicked", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll(".app-btn-stub");
    const uploadBtn = buttons.find((btn) =>
      btn.text().includes("upload avatar"),
    );
    await uploadBtn?.trigger("click");
    expect(mockTriggerAvatarPicker).toHaveBeenCalled();
  });

  it("shows uploading label while upload is in progress", () => {
    accountState.avatarUploadStatus.value = "uploading";
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("uploading");
  });

  it("shows avatar updated message after successful upload", () => {
    accountState.avatarUploadStatus.value = "done";
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Avatar updated.");
  });

  it("shows avatar error message on upload failure", () => {
    accountState.avatarUploadStatus.value = "error";
    accountState.avatarUploadError.value = "Image must be 1 MB or smaller.";
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Image must be 1 MB or smaller.");
  });

  it("calls saveChanges when save button is clicked", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll(".app-btn-stub");
    const saveBtn = buttons.find((btn) => btn.text().includes("save changes"));
    await saveBtn?.trigger("click");
    expect(mockSaveChanges).toHaveBeenCalled();
  });

  it("calls cancelChanges when cancel is clicked", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll(".app-btn-stub");
    const cancelBtn = buttons.find((btn) => btn.text() === "cancel");
    await cancelBtn?.trigger("click");
    expect(mockCancelChanges).toHaveBeenCalled();
  });

  it("shows saving label while save is in progress", () => {
    accountState.saveStatus.value = "saving";
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("saving");
  });

  it("shows success alert after save", () => {
    accountState.saveStatus.value = "saved";
    const wrapper = mountComponent();
    const alert = wrapper.find('.app-alert-stub[data-tone="ok"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("Profile saved.");
  });

  it("shows error alert when save fails", () => {
    accountState.saveStatus.value = "error";
    accountState.saveError.value = "Something went wrong.";
    const wrapper = mountComponent();
    const alert = wrapper.find('.app-alert-stub[data-tone="err"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("Something went wrong.");
  });

  it("shows loading label on manage button while sessions load", () => {
    accountState.sessionsStatus.value = "loading";
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("loading");
  });

  it("shows loaded sessions list when sessions exist", () => {
    accountState.sessionsStatus.value = "loaded";
    accountState.sessions.value = [
      {
        id: "sess_1",
        status: "active",
        latestActivity: {
          deviceType: "MacBook",
          city: "Denver",
          country: "US",
        },
      },
    ];
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("MacBook");
  });

  it("shows sessions error alert", () => {
    accountState.sessionsStatus.value = "error";
    accountState.sessionsError.value = "Could not load sessions.";
    const wrapper = mountComponent();
    const alert = wrapper.find('.app-alert-stub[data-tone="err"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("Could not load sessions.");
  });

  it("opens delete modal when delete button is clicked", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll(".app-btn-stub");
    const deleteBtn = buttons.find((btn) => btn.text().includes("delete"));
    await deleteBtn?.trigger("click");
    const modal = wrapper.find('.delete-modal-stub[data-open="true"]');
    expect(modal.exists()).toBe(true);
  });

  it("calls loadSessions when manage button is clicked", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll(".app-btn-stub");
    const manageBtn = buttons.find((btn) => btn.text() === "manage");
    await manageBtn?.trigger("click");
    expect(mockLoadSessions).toHaveBeenCalled();
  });
});
