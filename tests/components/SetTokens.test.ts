import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import type { ApiToken } from "../../app/composables/useApiTokens";

const STUB_TOKENS: ApiToken[] = [
  {
    id: "uuid-1",
    name: "obsidian-laptop",
    prefix: "mp_live_8f2a",
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    lastUsedAt: new Date("2026-06-27T00:00:00.000Z"),
  },
  {
    id: "uuid-2",
    name: "home-server",
    prefix: "mp_live_2c71",
    createdAt: new Date("2026-03-18T00:00:00.000Z"),
    lastUsedAt: null,
  },
];

const mockLoadTokens = vi.fn();
const mockMintToken = vi.fn();
const mockRevokeToken = vi.fn();
const mockClearRevealedToken = vi.fn();

const mockTokens = ref<ApiToken[]>([]);
const mockIsLoading = ref(false);
const mockLoadError = ref<string | null>(null);
const mockIsMinting = ref(false);
const mockMintError = ref<string | null>(null);
const mockIsRevoking = ref(false);
const mockRevokeError = ref<string | null>(null);
const mockRevealedToken = ref("");

vi.stubGlobal("useApiTokens", () => ({
  tokens: mockTokens,
  isLoading: mockIsLoading,
  loadError: mockLoadError,
  isMinting: mockIsMinting,
  mintError: mockMintError,
  isRevoking: mockIsRevoking,
  revokeError: mockRevokeError,
  revealedToken: mockRevealedToken,
  loadTokens: mockLoadTokens,
  mintToken: mockMintToken,
  revokeToken: mockRevokeToken,
  clearRevealedToken: mockClearRevealedToken,
}));

const globalConfig = {
  global: {
    stubs: {
      SetHead: true,
      AppAlert: {
        template:
          '<div class="app-alert" :data-tone="tone"><div class="a-title">{{ title }}</div><slot /><button v-if="closeable" class="alert-close" @click="$emit(\'close\')" /></div>',
        props: ["tone", "title", "closeable"],
        emits: ["close"],
      },
      AppBtn: {
        template:
          '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        props: ["variant", "size", "icon", "disabled"],
        emits: ["click"],
      },
      AppCopyBtn: { template: '<button class="copy-btn" />' },
      AppIcon: { template: '<span class="stub-icon" />' },
    },
  },
};

beforeEach(() => {
  mockLoadTokens.mockReset().mockResolvedValue(undefined);
  mockMintToken.mockReset().mockResolvedValue(undefined);
  mockRevokeToken.mockReset().mockResolvedValue(undefined);
  mockClearRevealedToken.mockReset();

  mockTokens.value = [];
  mockIsLoading.value = false;
  mockLoadError.value = null;
  mockIsMinting.value = false;
  mockMintError.value = null;
  mockIsRevoking.value = false;
  mockRevokeError.value = null;
  mockRevealedToken.value = "";
});

describe("SetTokens", () => {
  it("matches snapshot with no tokens loaded", async () => {
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot with tokens loaded", async () => {
    mockTokens.value = STUB_TOKENS;
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot in loading state", async () => {
    mockIsLoading.value = true;
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("calls loadTokens on mount", async () => {
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    mount(SetTokens, globalConfig);
    await flushPromises();
    expect(mockLoadTokens).toHaveBeenCalledOnce();
  });

  it("renders the token count from the tokens list", async () => {
    mockTokens.value = STUB_TOKENS;
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("2 active tokens");
  });

  it("renders each token name and prefix", async () => {
    mockTokens.value = STUB_TOKENS;
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("obsidian-laptop");
    expect(wrapper.html()).toContain("mp_live_8f2a");
    expect(wrapper.html()).toContain("home-server");
    expect(wrapper.html()).toContain("mp_live_2c71");
  });

  it("shows 'never' for a token with null lastUsedAt", async () => {
    mockTokens.value = [STUB_TOKENS[1]];
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("never");
  });

  it("shows loading text when isLoading is true", async () => {
    mockIsLoading.value = true;
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("loading…");
  });

  it("shows load error when loadError is set", async () => {
    mockLoadError.value = "Failed to load tokens.";
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("Failed to load tokens.");
  });

  it("shows mint error when mintError is set", async () => {
    mockMintError.value = "Server error.";
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("Server error.");
  });

  it("clicking retry calls loadTokens again", async () => {
    mockLoadError.value = "Failed to load tokens.";
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const retryButton = buttons.find((button) =>
      button.text().includes("retry"),
    );
    await retryButton?.trigger("click");

    expect(mockLoadTokens).toHaveBeenCalledTimes(2);
  });

  it("shows inline name form after clicking generate token", async () => {
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const generateButton = buttons.find((button) =>
      button.text().includes("generate token"),
    );
    await generateButton?.trigger("click");

    expect(wrapper.find("input.input").exists()).toBe(true);
    expect(wrapper.html()).toContain("Token name");
  });

  it("calls mintToken with the entered name when generate is confirmed", async () => {
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();

    const generateButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("generate token"));
    await generateButton?.trigger("click");

    await wrapper.find("input.input").setValue("my-new-token");

    const confirmButton = wrapper
      .findAll("button")
      .find(
        (button) =>
          button.text() === "generate" || button.text() === "generating…",
      );
    await confirmButton?.trigger("click");
    await flushPromises();

    expect(mockMintToken).toHaveBeenCalledWith("my-new-token");
  });

  it("does not call mintToken when name is blank", async () => {
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();

    const generateButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("generate token"));
    await generateButton?.trigger("click");

    const confirmButton = wrapper
      .findAll("button")
      .find(
        (button) =>
          button.text() === "generate" || button.text() === "generating…",
      );
    await confirmButton?.trigger("click");
    await flushPromises();

    expect(mockMintToken).not.toHaveBeenCalled();
  });

  it("hides the name form when cancel is clicked", async () => {
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();

    const generateButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("generate token"));
    await generateButton?.trigger("click");

    expect(wrapper.find("input.input").exists()).toBe(true);

    const cancelButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("cancel"));
    await cancelButton?.trigger("click");

    expect(wrapper.find("input.input").exists()).toBe(false);
  });

  it("shows the revealed token alert when revealedToken is set", async () => {
    mockRevealedToken.value = "mp_live_abc123"; // gitleaks:allow
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("mp_live_abc123");
    expect(wrapper.html()).toContain("Copy your new token now");
  });

  it("calls clearRevealedToken when the token alert close event fires", async () => {
    mockRevealedToken.value = "mp_live_abc123"; // gitleaks:allow
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();

    const closeButton = wrapper.find(".alert-close");
    await closeButton.trigger("click");

    expect(mockClearRevealedToken).toHaveBeenCalledOnce();
  });

  it("calls revokeToken with the token id when trash button is clicked", async () => {
    mockTokens.value = [STUB_TOKENS[0]];
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();

    const trashButton = wrapper.find("button[title='revoke']");
    await trashButton.trigger("click");

    expect(mockRevokeToken).toHaveBeenCalledWith("uuid-1");
  });

  it("keeps the generate form open when mintToken sets mintError", async () => {
    mockMintToken.mockImplementation(async () => {
      mockMintError.value = "Server error.";
    });

    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();

    const generateButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("generate token"));
    await generateButton?.trigger("click");
    await wrapper.find("input.input").setValue("my-token");

    const confirmButton = wrapper
      .findAll("button")
      .find(
        (button) =>
          button.text() === "generate" || button.text() === "generating…",
      );
    await confirmButton?.trigger("click");
    await flushPromises();

    expect(wrapper.find("input.input").exists()).toBe(true);
  });

  it("shows revokeError when revokeError is set", async () => {
    mockRevokeError.value = "Failed to revoke token.";
    const SetTokens = (
      await import("../../app/components/settings/SetTokens.vue")
    ).default;
    const wrapper = mount(SetTokens, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("Failed to revoke token.");
    expect(wrapper.html()).toContain("Failed to revoke token");
  });
});
