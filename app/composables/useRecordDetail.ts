import type { RecordResource } from "./useRecords";

const NOT_FOUND_STATUS = 404;
const RECORD_MISSING_MESSAGE = "Record not found. It may have been removed.";
const RECORD_LOAD_FAILED_MESSAGE = "Failed to load record. Please try again.";

type RecordDetailResponse = {
  data: RecordResource | null;
};

function isNotFoundError(error: unknown): boolean {
  return (error as { statusCode?: number })?.statusCode === NOT_FOUND_STATUS;
}

export async function fetchRecord(
  uuid: string,
): Promise<RecordResource | null> {
  const response = await $fetch<RecordDetailResponse>(
    `/api/records/${encodeURIComponent(uuid)}`,
  );
  return response.data ?? null;
}

export function useRecordDetail() {
  const record = ref<RecordResource | null>(null);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  // A slow request for record A must not overwrite a newer request for record
  // B. Each call claims the latest id; stale responses are dropped.
  let latestRequestId = 0;

  async function open(uuid: string): Promise<void> {
    const requestId = ++latestRequestId;
    isLoading.value = true;
    loadError.value = null;
    record.value = null;

    try {
      const fetched = await fetchRecord(uuid);
      if (requestId !== latestRequestId) {
        return;
      }
      record.value = fetched;
      if (!fetched) {
        loadError.value = RECORD_MISSING_MESSAGE;
      }
    } catch (fetchError) {
      if (requestId !== latestRequestId) {
        return;
      }
      // ofetch throws on non-2xx, so a real 404 lands here, not the null
      // branch above. Distinguish "removed" from a transient failure.
      if (isNotFoundError(fetchError)) {
        loadError.value = RECORD_MISSING_MESSAGE;
        return;
      }
      console.error("[useRecordDetail] open error:", fetchError);
      loadError.value = RECORD_LOAD_FAILED_MESSAGE;
    } finally {
      if (requestId === latestRequestId) {
        isLoading.value = false;
      }
    }
  }

  function close(): void {
    // Invalidate any in-flight open() so its late response can't repopulate a
    // closed modal.
    latestRequestId += 1;
    record.value = null;
    loadError.value = null;
    isLoading.value = false;
  }

  return {
    record,
    isLoading,
    loadError,
    open,
    close,
  };
}
