import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mockFetchSettings = vi.fn();
const mockUpdateAppearance = vi.fn();
const mockPersistAccentLocally = vi.fn();
const mockPersistThemeChoiceLocally = vi.fn();
const mockSetTheme = vi.fn();
const mockGetStoredThemeChoice = vi.fn(() => null);
const mockGetStoredAccent = vi.fn(() => null);
const mockIsDark = ref(false);
const mockAccountAccent = ref<string | null>(null);
const mockAccountTheme = ref<string | null>(null);

vi.stubGlobal("useTheme", () => ({
  isDark: mockIsDark,
  setTheme: mockSetTheme,
  persistAccentLocally: mockPersistAccentLocally,
  persistThemeChoiceLocally: mockPersistThemeChoiceLocally,
  getStoredThemeChoice: mockGetStoredThemeChoice,
  getStoredAccent: mockGetStoredAccent,
  initTheme: vi.fn(),
  initAccent: vi.fn(),
  toggleTheme: vi.fn(),
}));

vi.stubGlobal("useSettings", () => ({
  theme: mockAccountTheme,
  accentColor: mockAccountAccent,
  fetchSettings: mockFetchSettings,
  updateAppearance: mockUpdateAppearance,
}));

const StubIcon = { template: '<span class="stub-icon" />' };
const StubBtn = { template: '<button class="stub-btn"><slot /></button>' };
const StubBadge = { template: '<span class="stub-badge"><slot /></span>' };
const StubField = { template: '<div class="stub-field"><slot /></div>' };

const globalConfig = {
  global: {
    components: {
      AppIcon: StubIcon,
      AppBtn: StubBtn,
      AppBadge: StubBadge,
      AppField: StubField,
      AppEyebrow: { template: '<span class="eyebrow"><slot /></span>' },
    },
    stubs: {
      SetHead: { template: '<div class="stub-set-head" />' },
    },
  },
};

beforeEach(() => {
  mockFetchSettings.mockReset().mockResolvedValue(undefined);
  mockUpdateAppearance.mockReset().mockResolvedValue(undefined);
  mockPersistAccentLocally.mockReset();
  mockPersistThemeChoiceLocally.mockReset();
  mockSetTheme.mockReset();
  mockGetStoredThemeChoice.mockReset().mockReturnValue(null);
  mockGetStoredAccent.mockReset().mockReturnValue(null);
  mockIsDark.value = false;
  mockAccountAccent.value = null;
  mockAccountTheme.value = null;
});

describe("SetAppearance", () => {
  it("matches snapshot", async () => {
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders all 8 accent colour buttons", async () => {
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    const accentGrid = wrapper.find('[style*="grid-template-columns"]');
    expect(accentGrid.findAll("button")).toHaveLength(8);
  });

  it("renders all 3 theme buttons", async () => {
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    const themeRow = wrapper.find(".row.wrap.gap-3");
    expect(themeRow.findAll("button")).toHaveLength(3);
  });

  it("calls fetchSettings on mount", async () => {
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    mount(SetAppearance, { ...globalConfig });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockFetchSettings).toHaveBeenCalledOnce();
  });

  it("highlights the stored accent from localStorage on mount", async () => {
    mockGetStoredAccent.mockReturnValue("#6366f1");
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const accentGrid = wrapper.find('[style*="grid-template-columns"]');
    const indigoButton = accentGrid.findAll("button")[1];
    expect(indigoButton.html()).toContain(
      "0 0 0 2px var(--surface), 0 0 0 4px #6366f1",
    );
  });

  it("calls updateAppearance and persistThemeChoiceLocally when a theme button is clicked", async () => {
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    const themeRow = wrapper.find(".row.wrap.gap-3");
    const darkButton = themeRow.findAll("button")[1];
    await darkButton.trigger("click");
    expect(mockPersistThemeChoiceLocally).toHaveBeenCalledWith("dark");
    expect(mockUpdateAppearance).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("calls updateAppearance and persistAccentLocally when an accent button is clicked", async () => {
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    const accentGrid = wrapper.find('[style*="grid-template-columns"]');
    const firstAccentButton = accentGrid.findAll("button")[0];
    await firstAccentButton.trigger("click");
    expect(mockPersistAccentLocally).toHaveBeenCalledWith("#a855f7");
    expect(mockUpdateAppearance).toHaveBeenCalledWith({
      accentColor: "#a855f7",
    });
  });

  it("applies account theme and accent from server after mount", async () => {
    mockFetchSettings.mockImplementation(async () => {
      mockAccountTheme.value = "dark";
      mockAccountAccent.value = "#6366f1";
    });
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    mount(SetAppearance, { ...globalConfig });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(mockPersistAccentLocally).toHaveBeenCalledWith("#6366f1");
  });

  it("uses localStorage theme choice on mount when present", async () => {
    mockGetStoredThemeChoice.mockReturnValue("system");
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const themeRow = wrapper.find(".row.wrap.gap-3");
    const systemButton = themeRow.findAll("button")[2];
    expect(systemButton.html()).toContain("0 0 0 3px var(--accent-tint)");
  });

  it("shows save error when updateAppearance rejects on theme select", async () => {
    mockUpdateAppearance.mockRejectedValueOnce(new Error("network error"));
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    const themeRow = wrapper.find(".row.wrap.gap-3");
    await themeRow.findAll("button")[0].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.html()).toContain("Couldn't save theme");
  });

  it("shows save error when updateAppearance rejects on accent select", async () => {
    mockUpdateAppearance.mockRejectedValueOnce(new Error("network error"));
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    const accentGrid = wrapper.find('[style*="grid-template-columns"]');
    await accentGrid.findAll("button")[1].trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.html()).toContain("Couldn't save accent colour");
  });

  it("shows load error when fetchSettings rejects", async () => {
    mockFetchSettings.mockRejectedValueOnce(new Error("fetch failed"));
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.html()).toContain("Couldn't load your account settings");
  });

  it("does not apply account theme when fetchSettings rejects", async () => {
    mockFetchSettings.mockRejectedValueOnce(new Error("fetch failed"));
    mockAccountTheme.value = "dark";
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    mount(SetAppearance, { ...globalConfig });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it("does not overwrite user theme selection when fetch resolves after user chose", async () => {
    let resolvesFetch!: () => void;
    mockFetchSettings.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvesFetch = resolve;
        }),
    );
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });

    const themeRow = wrapper.find(".row.wrap.gap-3");
    await themeRow.findAll("button")[1].trigger("click");

    mockAccountTheme.value = "light";
    resolvesFetch();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("does not overwrite user accent selection when fetch resolves after user chose", async () => {
    let resolvesFetch!: () => void;
    mockFetchSettings.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvesFetch = resolve;
        }),
    );
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    const wrapper = mount(SetAppearance, { ...globalConfig });

    const accentGrid = wrapper.find('[style*="grid-template-columns"]');
    await accentGrid.findAll("button")[2].trigger("click");

    mockAccountAccent.value = "#a855f7";
    resolvesFetch();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockPersistAccentLocally).toHaveBeenCalledOnce();
    expect(mockPersistAccentLocally).toHaveBeenCalledWith("#2f6fed");
  });

  it("ignores an invalid theme value from the account", async () => {
    mockFetchSettings.mockImplementation(async () => {
      mockAccountTheme.value = "neon";
    });
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    mount(SetAppearance, { ...globalConfig });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockPersistThemeChoiceLocally).not.toHaveBeenCalled();
  });

  it("ignores an invalid hex accent value from the account", async () => {
    mockFetchSettings.mockImplementation(async () => {
      mockAccountAccent.value = "not-a-color";
    });
    const SetAppearance = (
      await import("../../app/components/settings/SetAppearance.vue")
    ).default;
    mount(SetAppearance, { ...globalConfig });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockPersistAccentLocally).not.toHaveBeenCalled();
  });
});
