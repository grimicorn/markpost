import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed } from "vue";

vi.stubGlobal("definePageMeta", vi.fn());
vi.stubGlobal("onMounted", (fn: () => void) => fn());

const eventsRef = ref<object[]>([]);
const isLoadingRef = ref(false);
const loadErrorRef = ref<string | null>(null);

const logRef = computed(() =>
  eventsRef.value.map((event) => {
    const e = event as {
      attributes: { ts: string; kind: string; message: string };
    };
    return [e.attributes.ts, e.attributes.kind, e.attributes.message];
  }),
);

const mockLoadEvents = vi.fn();

const { mockTriggerExportDownload } = vi.hoisted(() => ({
  mockTriggerExportDownload: vi.fn(),
}));

vi.mock("../../app/composables/useEvents", () => ({
  useEvents: () => ({
    events: eventsRef,
    log: logRef,
    isLoading: isLoadingRef,
    loadError: loadErrorRef,
    loadEvents: mockLoadEvents,
  }),
  triggerExportDownload: mockTriggerExportDownload,
}));

import ActivityPage from "../../app/pages/activity.vue";

const globalConfig = {
  global: {
    stubs: {
      TheAppShell: { template: '<div><slot name="actions" /><slot /></div>' },
      AppAlert: {
        template: '<div class="app-alert" :data-tone="tone"><slot /></div>',
        props: ["tone", "title", "closeable"],
      },
      AppBtn: {
        template:
          '<button class="app-btn" @click="$emit(\'click\')"><slot /></button>',
        props: ["variant", "size", "icon", "disabled"],
        emits: ["click"],
      },
      AppIcon: { template: "<span />" },
    },
  },
};

function makeLogRow(
  kind: string = "ok",
  message: string = "webhook github:push → 99-incoming/deploy.md",
) {
  return {
    type: "events" as const,
    id: "evt-1",
    attributes: {
      id: "evt-1",
      userId: "user-1",
      ts: "09:41:02",
      kind,
      message,
      recordUuid: null,
      sourceId: null,
    },
    links: { self: "/api/events/evt-1" },
  };
}

describe("activity page", () => {
  beforeEach(() => {
    eventsRef.value = [];
    isLoadingRef.value = false;
    loadErrorRef.value = null;
    mockLoadEvents.mockReset();
    mockLoadEvents.mockResolvedValue(undefined);
    mockTriggerExportDownload.mockReset();
  });

  it("calls loadEvents on mount", async () => {
    mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(mockLoadEvents).toHaveBeenCalledOnce();
  });

  it("matches snapshot in loading state", async () => {
    isLoadingRef.value = true;
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot in error state", async () => {
    loadErrorRef.value = "Failed to load activity. Please try again.";
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot in empty state", async () => {
    eventsRef.value = [];
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot with events", async () => {
    eventsRef.value = [
      makeLogRow("ok"),
      makeLogRow("err", "conflict: file exists, skipped"),
    ];
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows loading indicator while isLoading is true", async () => {
    isLoadingRef.value = true;
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.text()).toContain("loading activity");
  });

  it("shows error alert when loadError is set", async () => {
    loadErrorRef.value = "Failed to load activity. Please try again.";
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.find(".app-alert").exists()).toBe(true);
  });

  it("shows empty state when log is empty", async () => {
    eventsRef.value = [];
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.text()).toContain("No activity yet");
  });

  it("does not show empty state when log has rows", async () => {
    eventsRef.value = [makeLogRow()];
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.text()).not.toContain("No activity yet");
  });

  it("calls triggerExportDownload when export button is clicked", async () => {
    eventsRef.value = [makeLogRow()];
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    await wrapper.find(".app-btn").trigger("click");
    expect(mockTriggerExportDownload).toHaveBeenCalledOnce();
  });

  it("does not show terminal when loading", async () => {
    isLoadingRef.value = true;
    eventsRef.value = [makeLogRow()];
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.text()).not.toContain("markpost sync --watch");
  });

  it("does not show terminal when there is an error", async () => {
    loadErrorRef.value = "Failed to load activity. Please try again.";
    eventsRef.value = [makeLogRow()];
    const wrapper = mount(ActivityPage, globalConfig);
    await flushPromises();
    expect(wrapper.text()).not.toContain("markpost sync --watch");
  });
});
