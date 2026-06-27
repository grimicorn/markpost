import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";

vi.stubGlobal("definePageMeta", vi.fn());
vi.stubGlobal("onMounted", (fn: () => void) => fn());

const mockLoadSources = vi.fn();
const mockAddSource = vi.fn();
const mockRemoveSource = vi.fn();

const sourcesRef = ref<object[]>([]);
const isLoadingRef = ref(false);

vi.mock("../../app/composables/useSources", () => ({
  useSources: () => ({
    sources: sourcesRef,
    isLoading: isLoadingRef,
    loadSources: mockLoadSources,
    addSource: mockAddSource,
    removeSource: mockRemoveSource,
  }),
  buildEndpointUrl: (type: string, slug: string) => {
    if (type === "email") {
      return `${slug}@in.markpost.io`;
    }
    return `https://ingest.markpost.io/v1/hooks/${slug}`;
  },
  buildSourceMeta: () => ["0 records", "never hit", "routes to 99-incoming/"],
}));

import SourcesPage from "../../app/pages/sources.vue";

const globalConfig = {
  global: {
    stubs: {
      TheAppShell: { template: '<div><slot name="actions" /><slot /></div>' },
      AppAlert: {
        template: '<div class="app-alert"><slot /></div>',
        props: ["tone", "title", "closeable"],
        emits: ["close"],
      },
      AppBtn: {
        template: "<button @click=\"$emit('click')\"><slot /></button>",
        emits: ["click"],
      },
      AppIcon: { template: "<span />" },
      SourceCard: {
        template:
          '<div class="source-card" @click="$emit(\'remove\', source.attributes.uuid)" />',
        props: ["source"],
        emits: ["remove"],
      },
      AddSourceModal: {
        template: '<div class="add-source-modal" />',
        props: ["modalState"],
        emits: ["close", "pick", "add"],
      },
      ConfirmDialog: {
        template:
          '<div class="confirm-dialog"><button class="confirm-btn" @click="$emit(\'confirm\')" /><button class="cancel-btn" @click="$emit(\'cancel\')" /></div>',
        props: ["title", "message", "confirmLabel"],
        emits: ["confirm", "cancel"],
      },
    },
  },
};

function makeSource(id = "uuid-1") {
  return {
    type: "sources" as const,
    id,
    attributes: {
      uuid: id,
      userId: "user-1",
      createdAt: "2025-01-01T00:00:00Z",
      type: "webhook",
      name: "Webhook endpoint",
      provider: null,
      endpointSlug: "wh_abc12345",
      routeFolder: "99-incoming/",
      fieldMapping: null,
      lastHitAt: null,
      recordCount: 0,
    },
    links: { self: `/api/sources/${id}` },
  };
}

describe("sources page", () => {
  beforeEach(() => {
    sourcesRef.value = [];
    isLoadingRef.value = false;
    mockLoadSources.mockReset();
    mockAddSource.mockReset();
    mockRemoveSource.mockReset();
  });

  it("calls loadSources on mount", () => {
    mount(SourcesPage, globalConfig);
    expect(mockLoadSources).toHaveBeenCalledOnce();
  });

  it("matches snapshot in loading state", () => {
    isLoadingRef.value = true;
    const wrapper = mount(SourcesPage, globalConfig);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot when loadSources throws", async () => {
    mockLoadSources.mockRejectedValue(new Error("network error"));
    const wrapper = mount(SourcesPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot in empty state", () => {
    sourcesRef.value = [];
    const wrapper = mount(SourcesPage, globalConfig);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot with sources", () => {
    sourcesRef.value = [makeSource("uuid-1"), makeSource("uuid-2")];
    const wrapper = mount(SourcesPage, globalConfig);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows loading indicator while isLoading is true", () => {
    isLoadingRef.value = true;
    const wrapper = mount(SourcesPage, globalConfig);
    expect(wrapper.text()).toContain("loading sources");
  });

  it("shows load error alert when loadSources throws", async () => {
    mockLoadSources.mockRejectedValue(new Error("network error"));
    const wrapper = mount(SourcesPage, globalConfig);
    await flushPromises();
    expect(wrapper.find(".app-alert").exists()).toBe(true);
  });

  it("does not hide sources list when remove fails", async () => {
    sourcesRef.value = [makeSource("uuid-1")];
    mockRemoveSource.mockRejectedValue(new Error("delete failed"));
    const wrapper = mount(SourcesPage, globalConfig);
    await wrapper.find(".source-card").trigger("click");
    await wrapper.find(".confirm-btn").trigger("click");
    await flushPromises();
    expect(wrapper.find(".source-card").exists()).toBe(true);
    expect(wrapper.find(".app-alert").exists()).toBe(true);
  });

  it("shows empty state when sources array is empty", () => {
    sourcesRef.value = [];
    const wrapper = mount(SourcesPage, globalConfig);
    expect(wrapper.text()).toContain("No sources yet");
  });

  it("renders a SourceCard for each source", () => {
    sourcesRef.value = [
      makeSource("uuid-1"),
      makeSource("uuid-2"),
      makeSource("uuid-3"),
    ];
    const wrapper = mount(SourcesPage, globalConfig);
    expect(wrapper.findAll(".source-card")).toHaveLength(3);
  });

  it("opens modal when 'add source' button is clicked", async () => {
    const wrapper = mount(SourcesPage, globalConfig);
    await wrapper.find("button").trigger("click");
    expect(wrapper.find(".add-source-modal").exists()).toBe(true);
  });

  it("shows confirm dialog when remove is requested from a SourceCard", async () => {
    sourcesRef.value = [makeSource("uuid-1")];
    const wrapper = mount(SourcesPage, globalConfig);
    await wrapper.find(".source-card").trigger("click");
    expect(wrapper.find(".confirm-dialog").exists()).toBe(true);
  });

  it("calls removeSource with the source uuid when confirm dialog is confirmed", async () => {
    sourcesRef.value = [makeSource("uuid-1")];
    mockRemoveSource.mockResolvedValue(undefined);
    const wrapper = mount(SourcesPage, globalConfig);
    await wrapper.find(".source-card").trigger("click");
    await wrapper.find(".confirm-btn").trigger("click");
    await flushPromises();
    expect(mockRemoveSource).toHaveBeenCalledWith("uuid-1");
  });

  it("dismisses confirm dialog without removing when cancel is clicked", async () => {
    sourcesRef.value = [makeSource("uuid-1")];
    const wrapper = mount(SourcesPage, globalConfig);
    await wrapper.find(".source-card").trigger("click");
    await wrapper.find(".cancel-btn").trigger("click");
    expect(mockRemoveSource).not.toHaveBeenCalled();
    expect(wrapper.find(".confirm-dialog").exists()).toBe(false);
  });
});
