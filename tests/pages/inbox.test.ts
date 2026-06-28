import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";

vi.stubGlobal("definePageMeta", vi.fn());

const recordsRef = ref<object[]>([]);
const isLoadingRef = ref(false);
const loadErrorRef = ref<string | null>(null);
const filterRef = ref("all");

const mockLoadRecords = vi.fn();
const mockFetchRecordStats = vi.fn();

vi.mock("../../app/composables/useRecords", () => ({
  useRecords: () => ({
    records: recordsRef,
    isLoading: isLoadingRef,
    loadError: loadErrorRef,
    filter: filterRef,
    loadRecords: mockLoadRecords,
  }),
  get fetchRecordStats() {
    return mockFetchRecordStats;
  },
  formatRelativeTime: (isoString: string) => {
    void isoString;
    return "2m ago";
  },
}));

import InboxPage from "../../app/pages/inbox.vue";

const globalConfig = {
  global: {
    stubs: {
      TheAppShell: { template: '<div><slot name="actions" /><slot /></div>' },
      AppAlert: {
        template: '<div class="app-alert" :data-tone="tone"><slot /></div>',
        props: ["tone", "title", "closeable"],
        emits: ["close"],
      },
      AppBtn: {
        template:
          '<button class="app-btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        props: ["variant", "size", "icon", "disabled"],
        emits: ["click"],
      },
      AppIcon: { template: "<span />" },
      AppBadge: {
        template: '<span class="app-badge"><slot /></span>',
        props: ["tone", "dot"],
      },
      InputSegmented: {
        template: "<div />",
        props: ["modelValue", "options"],
        emits: ["update:modelValue"],
      },
    },
  },
};

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    type: "records" as const,
    id: "uuid-1",
    attributes: {
      uuid: "uuid-1",
      createdAt: "2026-06-27T10:00:00Z",
      userId: "user-1",
      title: "Test Record",
      content: "Content here",
      sourceId: null,
      source: "webhook/github",
      status: "synced",
      filePath: "99-incoming/test.md",
      tags: null,
      frontmatter: null,
      syncedAt: null,
      errorMessage: null,
      ...overrides,
    },
    links: { self: "/api/records/uuid-1" },
  };
}

const defaultStats = { syncedToday: 12, pending: 1, errors: 1, thisMonth: 284 };

describe("inbox page", () => {
  beforeEach(() => {
    recordsRef.value = [];
    isLoadingRef.value = false;
    loadErrorRef.value = null;
    filterRef.value = "all";
    mockLoadRecords.mockReset();
    mockLoadRecords.mockResolvedValue(undefined);
    mockFetchRecordStats.mockReset();
    mockFetchRecordStats.mockResolvedValue(defaultStats);
  });

  it("calls loadRecords on mount", async () => {
    mount(InboxPage, globalConfig);
    await flushPromises();
    expect(mockLoadRecords).toHaveBeenCalledOnce();
  });

  it("fetches stats on mount", async () => {
    mount(InboxPage, globalConfig);
    await flushPromises();
    expect(mockFetchRecordStats).toHaveBeenCalledOnce();
  });

  it("matches snapshot in loading state", async () => {
    isLoadingRef.value = true;
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot in empty state", async () => {
    recordsRef.value = [];
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot with records", async () => {
    recordsRef.value = [makeRecord(), makeRecord({ title: "Another" })];
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot in error state", async () => {
    loadErrorRef.value = "Failed to load records. Please try again.";
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows loading indicator while isLoading is true", async () => {
    isLoadingRef.value = true;
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.text()).toContain("loading records");
  });

  it("shows error alert when loadError is set", async () => {
    loadErrorRef.value = "Failed to load records. Please try again.";
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.find(".app-alert").exists()).toBe(true);
  });

  it("shows empty state when records array is empty", async () => {
    recordsRef.value = [];
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.text()).toContain("No records yet");
  });

  it("renders a badge for each record", async () => {
    recordsRef.value = [makeRecord(), makeRecord({ title: "Another" })];
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.findAll(".app-badge")).toHaveLength(2);
  });

  it("shows success toast after sync now when no load error", async () => {
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    await wrapper.find(".app-btn").trigger("click");
    await flushPromises();
    expect(wrapper.find(".app-alert[data-tone='ok']").exists()).toBe(true);
  });

  it("shows sync error alert when loadRecords sets loadError during sync", async () => {
    mockLoadRecords
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        loadErrorRef.value = "Failed to load records. Please try again.";
      });
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    await wrapper.find(".app-btn").trigger("click");
    await flushPromises();
    expect(wrapper.find(".app-alert[data-tone='err']").exists()).toBe(true);
  });

  it("does not show success toast when loadError is set after sync", async () => {
    mockLoadRecords
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        loadErrorRef.value = "Failed to load records. Please try again.";
      });
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    await wrapper.find(".app-btn").trigger("click");
    await flushPromises();
    expect(wrapper.find(".app-alert[data-tone='ok']").exists()).toBe(false);
  });

  it("displays em-dash for records with no filePath", async () => {
    recordsRef.value = [makeRecord({ filePath: null })];
    const wrapper = mount(InboxPage, globalConfig);
    await flushPromises();
    expect(wrapper.text()).toContain("—");
  });
});
