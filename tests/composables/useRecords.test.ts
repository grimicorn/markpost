import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

import {
  formatRelativeTime,
  fetchRecordStats,
} from "../../app/composables/useRecords";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-27T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for times within the last minute", () => {
    const isoString = new Date(Date.now() - 30 * 1000).toISOString();
    expect(formatRelativeTime(isoString)).toBe("just now");
  });

  it("returns minutes ago for times within the last hour", () => {
    const isoString = new Date(Date.now() - 14 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString)).toBe("14m ago");
  });

  it("returns hours ago for times within the same day", () => {
    const isoString = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString)).toBe("3h ago");
  });

  it("returns 'yesterday' for times exactly 1 day ago", () => {
    const isoString = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString)).toBe("yesterday");
  });

  it("returns days ago for times more than 1 day ago", () => {
    const isoString = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatRelativeTime(isoString)).toBe("5d ago");
  });

  it("returns em-dash for an invalid date string", () => {
    expect(formatRelativeTime("not-a-date")).toBe("—");
  });

  it("returns em-dash for an empty string", () => {
    expect(formatRelativeTime("")).toBe("—");
  });
});

describe("fetchRecordStats", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns stats data on success", async () => {
    const statsData = { syncedToday: 5, pending: 2, errors: 1, thisMonth: 42 };
    mockFetch.mockResolvedValue({ data: statsData });

    const result = await fetchRecordStats();

    expect(result).toEqual(statsData);
    expect(mockFetch).toHaveBeenCalledWith("/api/records/stats");
  });

  it("returns null on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const result = await fetchRecordStats();

    expect(result).toBeNull();
  });
});
