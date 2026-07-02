import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

import {
  searchRecords,
  useRecordSearch,
} from "../../app/composables/useRecordSearch";

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

describe("searchRecords", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns an empty array without calling fetch when the query is too short", async () => {
    const result = await searchRecords("a");

    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("trims the query and fetches matching records", async () => {
    const record = makeRecord();
    mockFetch.mockResolvedValue({ data: [record] });

    const result = await searchRecords("  test  ");

    expect(result).toEqual([record]);
    expect(mockFetch).toHaveBeenCalledWith("/api/records", {
      query: { "filter[q]": "test", "page[size]": 8 },
    });
  });

  it("returns an empty array on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const result = await searchRecords("test");

    expect(result).toEqual([]);
  });
});

describe("useRecordSearch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces the search and populates results", async () => {
    const record = makeRecord();
    mockFetch.mockResolvedValue({ data: [record] });

    const { query, results } = useRecordSearch();
    query.value = "test";

    await vi.advanceTimersByTimeAsync(250);

    expect(results.value).toEqual([record]);
  });

  it("clears results via clearResults", async () => {
    const record = makeRecord();
    mockFetch.mockResolvedValue({ data: [record] });

    const { query, results, clearResults } = useRecordSearch();
    query.value = "test";
    await vi.advanceTimersByTimeAsync(250);
    expect(results.value).toHaveLength(1);

    clearResults();

    expect(results.value).toEqual([]);
  });

  it("clears results instead of searching when the query is too short", async () => {
    mockFetch.mockResolvedValue({ data: [makeRecord()] });

    const { query, results } = useRecordSearch();
    query.value = "a";

    await vi.advanceTimersByTimeAsync(250);

    expect(results.value).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("only fires one search when the query changes rapidly within the debounce window", async () => {
    mockFetch.mockResolvedValue({ data: [] });

    const { query } = useRecordSearch();
    query.value = "t";
    await vi.advanceTimersByTimeAsync(100);
    query.value = "te";
    await vi.advanceTimersByTimeAsync(250);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("discards a slow, stale response once the query has moved on", async () => {
    let resolveFirstFetch: (value: { data: unknown[] }) => void = () => {};
    const firstFetch = new Promise<{ data: unknown[] }>((resolve) => {
      resolveFirstFetch = resolve;
    });
    mockFetch.mockReturnValueOnce(firstFetch);

    const { query, results } = useRecordSearch();
    query.value = "first";
    await vi.advanceTimersByTimeAsync(250);

    // The first request is still in flight. Typing a new query queues and
    // resolves a second, faster search before the first one returns.
    const secondRecord = makeRecord({ uuid: "second" });
    mockFetch.mockResolvedValueOnce({ data: [secondRecord] });
    query.value = "second";
    await vi.advanceTimersByTimeAsync(250);
    expect(results.value).toEqual([secondRecord]);

    // The stale first request finally resolves; it must not overwrite the
    // results for the query that superseded it.
    resolveFirstFetch({ data: [makeRecord({ uuid: "first" })] });
    await vi.advanceTimersByTimeAsync(0);

    expect(results.value).toEqual([secondRecord]);
  });

  it("resets isSearching even when a stale response is discarded", async () => {
    let resolveFirstFetch: (value: { data: unknown[] }) => void = () => {};
    const firstFetch = new Promise<{ data: unknown[] }>((resolve) => {
      resolveFirstFetch = resolve;
    });
    mockFetch.mockReturnValueOnce(firstFetch);

    const { query, isSearching } = useRecordSearch();
    query.value = "first";
    await vi.advanceTimersByTimeAsync(250);
    expect(isSearching.value).toBe(true);

    // The next query is too short to search, so its own run bails out via
    // the min-length guard before ever touching isSearching.
    query.value = "a";
    await vi.advanceTimersByTimeAsync(250);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // The stale first request finally resolves; isSearching must still be
    // reset even though its result is discarded as stale.
    resolveFirstFetch({ data: [makeRecord({ uuid: "first" })] });
    await vi.advanceTimersByTimeAsync(0);

    expect(isSearching.value).toBe(false);
  });
});
