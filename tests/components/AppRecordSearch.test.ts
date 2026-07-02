import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { ref } from "vue";
import AppIcon from "../../app/components/AppIcon.vue";
import AppKbd from "../../app/components/AppKbd.vue";
import type { RecordResource } from "../../app/composables/useRecords";

const mockQuery = ref("");
const mockResults = ref<RecordResource[]>([]);
const mockClearResults = vi.fn(() => {
  mockResults.value = [];
});

vi.mock("~/composables/useRecordSearch", () => ({
  useRecordSearch: () => ({
    query: mockQuery,
    results: mockResults,
    clearResults: mockClearResults,
  }),
}));

import AppRecordSearch from "../../app/components/AppRecordSearch.vue";

const globalConfig = {
  global: {
    components: { AppIcon, AppKbd },
  },
};

function makeRecord(overrides: Partial<RecordResource["attributes"]> = {}) {
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
      status: "synced" as const,
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

let activeWrapper: VueWrapper | null = null;

function mountSearch() {
  activeWrapper = mount(AppRecordSearch, {
    ...globalConfig,
    attachTo: document.body,
  });
  return activeWrapper;
}

describe("AppRecordSearch", () => {
  beforeEach(() => {
    mockQuery.value = "";
    mockResults.value = [];
    mockClearResults.mockClear();
  });

  afterEach(() => {
    activeWrapper?.unmount();
    activeWrapper = null;
    document.body.innerHTML = "";
  });

  it("matches snapshot with no results", () => {
    const wrapper = mountSearch();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot with results while focused", async () => {
    mockResults.value = [makeRecord({ title: "Invoice #42" })];
    const wrapper = mountSearch();
    await wrapper.find("input").trigger("focus");
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("does not show the dropdown when unfocused even with results", () => {
    mockResults.value = [makeRecord()];
    const wrapper = mountSearch();
    expect(wrapper.find(".card").exists()).toBe(false);
  });

  it("shows the dropdown once focused with results", async () => {
    mockResults.value = [makeRecord({ title: "Invoice #42" })];
    const wrapper = mountSearch();
    await wrapper.find("input").trigger("focus");
    expect(wrapper.text()).toContain("Invoice #42");
  });

  it("hides the dropdown again once blurred", async () => {
    mockResults.value = [makeRecord()];
    const wrapper = mountSearch();
    await wrapper.find("input").trigger("focus");
    expect(wrapper.find(".card").exists()).toBe(true);
    await wrapper.find("input").trigger("blur");
    expect(wrapper.find(".card").exists()).toBe(false);
  });

  it("emits select and clears the query when a result is clicked", async () => {
    mockQuery.value = "invoice";
    mockResults.value = [makeRecord({ uuid: "record-42" })];
    const wrapper = mountSearch();
    await wrapper.find("input").trigger("focus");

    await wrapper.find(".card button").trigger("click");

    expect(wrapper.emitted("select")?.[0]).toEqual([
      makeRecord({ uuid: "record-42" }),
    ]);
    expect(mockQuery.value).toBe("");
    expect(mockClearResults).toHaveBeenCalled();
  });

  it("emits select for the top result on Enter", async () => {
    mockResults.value = [
      makeRecord({ uuid: "record-1" }),
      makeRecord({ uuid: "record-2" }),
    ];
    const wrapper = mountSearch();
    await wrapper.find("input").trigger("focus");
    await wrapper.find("input").trigger("keydown.enter");

    expect(wrapper.emitted("select")?.[0]).toEqual([
      makeRecord({ uuid: "record-1" }),
    ]);
  });

  it("does not emit select on Enter when there are no results", async () => {
    mockResults.value = [];
    const wrapper = mountSearch();
    await wrapper.find("input").trigger("focus");
    await wrapper.find("input").trigger("keydown.enter");

    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("clears the query and blurs the input on Escape", async () => {
    mockQuery.value = "test";
    mockResults.value = [makeRecord()];
    const wrapper = mountSearch();
    const input = wrapper.find("input");
    await input.trigger("focus");
    await input.trigger("keydown.esc");

    expect(mockQuery.value).toBe("");
    expect(mockClearResults).toHaveBeenCalled();
  });

  it("exposes focus() so a parent can focus the input programmatically", () => {
    const wrapper = mountSearch();
    const inputElement = wrapper.find("input").element as HTMLInputElement;

    (wrapper.vm as unknown as { focus: () => void }).focus();

    expect(document.activeElement).toBe(inputElement);
  });
});
