import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import SetSync from "../../app/components/settings/SetSync.vue";

const DEFAULT_SETTINGS = {
  autoSync: true,
  autoDelete: false,
  frontmatter: true,
  conflictStrategy: "suffix",
  vaultDir: "~/Documents/Vault",
  filenameTemplate: "{{date}}-{{slug}}.md",
};

function makeSuccessResponse(overrides = {}) {
  return {
    data: {
      type: "user_settings",
      id: "user_123",
      attributes: { ...DEFAULT_SETTINGS, ...overrides },
    },
  };
}

function makeErrorResponse(detail = "Something went wrong.") {
  return { errors: [{ detail }] };
}

const mockFetch = vi.fn();

vi.stubGlobal("$fetch", mockFetch);

const globalConfig = {
  global: {
    stubs: {
      SetHead: true,
      SetRow: { template: "<div><slot /></div>" },
      AppAlert: {
        template: '<div class="app-alert" :data-tone="tone"><slot /></div>',
        props: ["tone", "title"],
      },
      AppBtn: {
        template:
          '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        props: ["variant", "icon", "disabled"],
        emits: ["click"],
      },
      AppIcon: true,
      AppBadge: true,
      AppField: { template: "<div><slot /></div>" },
      InputToggle: {
        template:
          '<input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        props: ["modelValue", "disabled"],
        emits: ["update:modelValue"],
      },
      InputSegmented: {
        template:
          '<div class="seg"><button v-for="o in options" :key="o.value" :disabled="disabled" :class="modelValue === o.value ? \'on\' : \'\'" @click="$emit(\'update:modelValue\', o.value)">{{ o.label }}</button></div>',
        props: ["modelValue", "options", "disabled"],
        emits: ["update:modelValue"],
      },
    },
  },
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("SetSync", () => {
  it("matches snapshot in loading state (before fetch resolves)", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const wrapper = mount(SetSync, globalConfig);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot after settings load successfully", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse());
    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot when load fails", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse("DB unavailable."));
    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows load error alert when settings fail to load", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse("DB unavailable."));
    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toContain("DB unavailable.");
  });

  it("does not show a load error when settings load successfully", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse());
    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();
    const alerts = wrapper.findAll(".app-alert");
    const loadErrorShowing = alerts.some(
      (alert) => alert.attributes("data-tone") === "err",
    );
    expect(loadErrorShowing).toBe(false);
  });

  it("calls GET /api/settings on mount", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse());
    mount(SetSync, globalConfig);
    await flushPromises();
    expect(mockFetch).toHaveBeenCalledWith("/api/settings");
  });

  it("shows a retry button when load fails and retrying calls load again", async () => {
    mockFetch
      .mockResolvedValueOnce(makeErrorResponse("DB unavailable."))
      .mockResolvedValueOnce(makeSuccessResponse());

    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();

    expect(wrapper.html()).toContain("DB unavailable.");

    const buttons = wrapper.findAll("button");
    const retryButton = buttons.find((button) =>
      button.text().includes("retry"),
    );
    await retryButton?.trigger("click");
    await flushPromises();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(wrapper.html()).not.toContain("DB unavailable.");
  });

  it("disables save and reset buttons until load succeeds", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse("DB unavailable."));
    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const saveButton = buttons.find((button) =>
      button.text().includes("save sync settings"),
    );
    const resetButton = buttons.find((button) =>
      button.text().includes("reset"),
    );

    expect((saveButton?.element as HTMLButtonElement).disabled).toBe(true);
    expect((resetButton?.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls PUT /api/settings when save is clicked", async () => {
    mockFetch
      .mockResolvedValueOnce(makeSuccessResponse())
      .mockResolvedValueOnce(makeSuccessResponse());

    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const saveButton = buttons.find((button) =>
      button.text().includes("save sync settings"),
    );
    await saveButton?.trigger("click");
    await flushPromises();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("shows success alert after a successful save", async () => {
    mockFetch
      .mockResolvedValueOnce(makeSuccessResponse())
      .mockResolvedValueOnce(makeSuccessResponse());

    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const saveButton = buttons.find((button) =>
      button.text().includes("save sync settings"),
    );
    await saveButton?.trigger("click");
    await flushPromises();

    expect(wrapper.html()).toContain("Sync settings saved.");
  });

  it("shows save error alert when PUT fails", async () => {
    mockFetch
      .mockResolvedValueOnce(makeSuccessResponse())
      .mockResolvedValueOnce(makeErrorResponse("Validation failed."));

    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();

    const buttons = wrapper.findAll("button");
    const saveButton = buttons.find((button) =>
      button.text().includes("save sync settings"),
    );
    await saveButton?.trigger("click");
    await flushPromises();

    expect(wrapper.html()).toContain("Validation failed.");
  });

  it("restores settings to last saved values when reset is clicked", async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({ vaultDir: "~/OriginalVault" }),
    );

    const wrapper = mount(SetSync, globalConfig);
    await flushPromises();

    const vaultInput = wrapper.find('input[class*="has-lead"]');
    await vaultInput.setValue("~/ChangedVault");

    const buttons = wrapper.findAll("button");
    const resetButton = buttons.find((button) =>
      button.text().includes("reset"),
    );
    await resetButton?.trigger("click");
    await flushPromises();

    expect(
      (wrapper.find('input[class*="has-lead"]').element as HTMLInputElement)
        .value,
    ).toBe("~/OriginalVault");
  });
});
