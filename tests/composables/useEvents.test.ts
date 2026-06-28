import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

import {
  eventToLogRow,
  triggerExportDownload,
  useEvents,
  type EventResource,
} from "../../app/composables/useEvents";

function makeEvent(
  overrides: Partial<EventResource["attributes"]> = {},
): EventResource {
  return {
    type: "events",
    id: "evt-1",
    attributes: {
      id: "evt-1",
      userId: "user-1",
      ts: "2026-06-27T09:41:02.000Z",
      kind: "ok",
      message: "webhook github:push → 99-incoming/deploy.md",
      recordUuid: null,
      sourceId: null,
      ...overrides,
    },
    links: { self: "/api/events/evt-1" },
  };
}

describe("eventToLogRow", () => {
  it("formats the timestamp as HH:MM:SS", () => {
    const event = makeEvent({ ts: "2026-06-27T09:41:02.000Z" });
    const [time] = eventToLogRow(event);
    expect(time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("returns em-dash for an invalid timestamp", () => {
    const event = makeEvent({ ts: "not-a-date" });
    const [time] = eventToLogRow(event);
    expect(time).toBe("—");
  });

  it("passes through valid kind values", () => {
    for (const kind of ["ok", "dim", "warn", "err"] as const) {
      const event = makeEvent({ kind });
      const [, rowKind] = eventToLogRow(event);
      expect(rowKind).toBe(kind);
    }
  });

  it("falls back to 'dim' for an unrecognized kind", () => {
    const event = makeEvent({ kind: "unknown" });
    const [, rowKind] = eventToLogRow(event);
    expect(rowKind).toBe("dim");
  });

  it("passes through the message", () => {
    const event = makeEvent({ message: "test message" });
    const [, , message] = eventToLogRow(event);
    expect(message).toBe("test message");
  });
});

describe("triggerExportDownload", () => {
  it("sets window.location.href to the export URL", () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });

    triggerExportDownload();
    expect(window.location.href).toBe("/api/events/export");
  });
});

describe("useEvents", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("starts with empty events and isLoading true", () => {
    const { events, isLoading, loadError } = useEvents();
    expect(events.value).toEqual([]);
    expect(isLoading.value).toBe(true);
    expect(loadError.value).toBeNull();
  });

  it("sets isLoading during fetch", async () => {
    let resolvePromise!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { isLoading, loadEvents } = useEvents();
    const loadPromise = loadEvents();

    expect(isLoading.value).toBe(true);

    resolvePromise({ data: [] });
    await loadPromise;

    expect(isLoading.value).toBe(false);
  });

  it("populates events from fetch response", async () => {
    const event = makeEvent();
    mockFetch.mockResolvedValue({ data: [event] });

    const { events, loadEvents } = useEvents();
    await loadEvents();

    expect(events.value).toHaveLength(1);
    expect(events.value[0].id).toBe("evt-1");
  });

  it("derives log rows from events", async () => {
    const event = makeEvent({ kind: "ok", message: "test msg" });
    mockFetch.mockResolvedValue({ data: [event] });

    const { log, loadEvents } = useEvents();
    await loadEvents();

    expect(log.value).toHaveLength(1);
    const [, kind, message] = log.value[0];
    expect(kind).toBe("ok");
    expect(message).toBe("test msg");
  });

  it("sets loadError on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const { loadError, loadEvents } = useEvents();
    await loadEvents();

    expect(loadError.value).toBe("Failed to load activity. Please try again.");
  });

  it("clears loadError on successful retry", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    mockFetch.mockResolvedValueOnce({ data: [] });

    const { loadError, loadEvents } = useEvents();
    await loadEvents();
    expect(loadError.value).not.toBeNull();

    await loadEvents();
    expect(loadError.value).toBeNull();
  });

  it("handles empty data array from API", async () => {
    mockFetch.mockResolvedValue({ data: [] });

    const { events, log, loadEvents } = useEvents();
    await loadEvents();

    expect(events.value).toEqual([]);
    expect(log.value).toEqual([]);
  });
});
