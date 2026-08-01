import type { RecordResource } from "./useRecords";

type RecordDetailResponse = {
  data: RecordResource | null;
};

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
        loadError.value = "Record not found. It may have been removed.";
      }
    } catch (fetchError) {
      if (requestId !== latestRequestId) {
        return;
      }
      console.error("[useRecordDetail] open error:", fetchError);
      loadError.value = "Failed to load record. Please try again.";
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
