export type EventKind = "ok" | "dim" | "warn" | "err";

export type EventAttributes = {
  id: string;
  userId: string;
  ts: string;
  kind: string;
  message: string;
  recordUuid: string | null;
  sourceId: string | null;
};

export type EventResource = {
  type: "events";
  id: string;
  attributes: EventAttributes;
  links: { self: string };
};

type EventListResponse = {
  data: EventResource[];
  links?: {
    next?: string | null;
  };
};

export type LogRow = [string, EventKind, string];

const EXPORT_URL = "/api/events/export";

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function isValidKind(kind: string): kind is EventKind {
  return kind === "ok" || kind === "dim" || kind === "warn" || kind === "err";
}

export function eventToLogRow(event: EventResource): LogRow {
  const time = formatTimestamp(event.attributes.ts);
  const kind = isValidKind(event.attributes.kind)
    ? event.attributes.kind
    : "dim";
  return [time, kind, event.attributes.message];
}

async function fetchEventPage(url: string): Promise<EventListResponse> {
  return $fetch<EventListResponse>(url);
}

async function fetchEventList(): Promise<EventResource[]> {
  const allEvents: EventResource[] = [];
  const visitedUrls = new Set<string>();
  let nextUrl: string | null | undefined = "/api/events";

  while (nextUrl && !visitedUrls.has(nextUrl)) {
    visitedUrls.add(nextUrl);
    const response = await fetchEventPage(nextUrl);
    allEvents.push(...(response.data ?? []));
    nextUrl = response.links?.next ?? null;
  }

  return allEvents;
}

export function triggerExportDownload(): void {
  window.location.href = EXPORT_URL;
}

export function useEvents() {
  const events = ref<EventResource[]>([]);
  const isLoading = ref(true);
  const loadError = ref<string | null>(null);

  const log = computed<LogRow[]>(() => events.value.map(eventToLogRow));

  async function loadEvents(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      events.value = await fetchEventList();
    } catch (fetchError) {
      console.error("[useEvents] loadEvents error:", fetchError);
      loadError.value = "Failed to load activity. Please try again.";
    } finally {
      isLoading.value = false;
    }
  }

  return {
    events,
    log,
    isLoading,
    loadError,
    loadEvents,
  };
}
