import { computeElapsedBuckets } from "../utils/timeBuckets";

export type RecordStatus = "synced" | "pending" | "error";

export type RecordAttributes = {
  uuid: string;
  createdAt: string;
  userId: string;
  title: string;
  content: string;
  sourceId: string | null;
  source: string | null;
  status: RecordStatus;
  filePath: string | null;
  tags: unknown;
  frontmatter: unknown;
  syncedAt: string | null;
  errorMessage: string | null;
};

export type RecordResource = {
  type: "records";
  id: string;
  attributes: RecordAttributes;
  links: { self: string };
};

export type RecordStats = {
  syncedToday: number;
  pending: number;
  errors: number;
  thisMonth: number;
};

type RecordListResponse = {
  data: RecordResource[];
  meta?: {
    total?: number;
    size?: number;
    hasMore?: boolean;
  };
};

type StatsResponse = {
  data: RecordStats;
};

export type RecordFilterValue = "all" | "webhook" | "email" | "errors";

type FetchFilters = {
  source?: string;
  status?: string;
};

function buildQueryParams(filter: RecordFilterValue): FetchFilters {
  if (filter === "errors") {
    return { status: "error" };
  }

  if (filter === "webhook" || filter === "email") {
    return { source: filter };
  }

  return {};
}

function buildFetchUrl(filter: RecordFilterValue): string {
  const filters = buildQueryParams(filter);
  const params = new URLSearchParams();

  if (filters.source) {
    params.set("filter[source]", filters.source);
  }

  if (filters.status) {
    params.set("filter[status]", filters.status);
  }

  const queryString = params.toString();
  return queryString ? `/api/records?${queryString}` : "/api/records";
}

async function fetchRecordList(
  filter: RecordFilterValue,
): Promise<RecordResource[]> {
  const url = buildFetchUrl(filter);
  const response = await $fetch<RecordListResponse>(url);
  return response.data ?? [];
}

export async function fetchRecordStats(): Promise<RecordStats | null> {
  try {
    const response = await $fetch<StatsResponse>("/api/records/stats");
    return response.data;
  } catch (fetchError) {
    console.error("[useRecords] fetchRecordStats error:", fetchError);
    return null;
  }
}

export type BadgeTone = "" | "ok" | "warn" | "err" | "info" | "accent";

export const STATUS_TONE_MAP: Record<string, BadgeTone> = {
  synced: "ok",
  pending: "warn",
  error: "err",
};

export function sourceTypeIcon(source: string | null): string {
  if (!source) {
    return "zap";
  }

  if (source.startsWith("email/")) {
    return "mail";
  }

  return "zap";
}

export function formatSourceLabel(source: string | null): string {
  if (!source) {
    return "unknown";
  }

  const slashIndex = source.indexOf("/");
  if (slashIndex === -1) {
    return source;
  }

  return source.slice(slashIndex + 1).replaceAll("/", " · ");
}

export function formatRelativeTime(isoString: string): string {
  const buckets = computeElapsedBuckets(isoString);

  if (!buckets) {
    return "—";
  }

  const { seconds, minutes, hours, days } = buckets;

  if (seconds < 60) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days === 1) {
    return "yesterday";
  }

  return `${days}d ago`;
}

export function useRecords(initialFilter: RecordFilterValue = "all") {
  const records = ref<RecordResource[]>([]);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);
  const filter = ref<RecordFilterValue>(initialFilter);

  async function loadRecords(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      records.value = await fetchRecordList(filter.value);
    } catch (fetchError) {
      console.error("[useRecords] loadRecords error:", fetchError);
      loadError.value = "Failed to load records. Please try again.";
    } finally {
      isLoading.value = false;
    }
  }

  watch(filter, loadRecords);

  return {
    records,
    isLoading,
    loadError,
    filter,
    loadRecords,
  };
}
