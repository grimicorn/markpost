import type { RecordResource } from "./useRecords";

export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_RESULT_LIMIT = 8;

type RecordSearchResponse = {
  data: RecordResource[];
};

export async function searchRecords(query: string): Promise<RecordResource[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
    return [];
  }

  try {
    const response = await $fetch<RecordSearchResponse>("/api/records", {
      query: {
        "filter[q]": trimmedQuery,
        "page[size]": SEARCH_RESULT_LIMIT,
      },
    });
    return response.data ?? [];
  } catch (fetchError) {
    console.error("[useRecordSearch] searchRecords error:", fetchError);
    return [];
  }
}

export function useRecordSearch() {
  const query = ref("");
  const results = ref<RecordResource[]>([]);
  const isSearching = ref(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function clearResults(): void {
    results.value = [];
  }

  async function runSearch(): Promise<void> {
    if (query.value.trim().length < SEARCH_MIN_QUERY_LENGTH) {
      clearResults();
      return;
    }

    isSearching.value = true;
    results.value = await searchRecords(query.value);
    isSearching.value = false;
  }

  function queueSearch(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
  }

  watch(query, queueSearch);

  return {
    query,
    results,
    isSearching,
    clearResults,
  };
}
