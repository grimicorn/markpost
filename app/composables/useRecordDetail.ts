import type { RecordResource } from "./useRecords";

type RecordDetailResponse = {
  data: RecordResource | null;
};

export async function fetchRecord(
  uuid: string,
): Promise<RecordResource | null> {
  const response = await $fetch<RecordDetailResponse>(`/api/records/${uuid}`);
  return response.data ?? null;
}

export function useRecordDetail() {
  const record = ref<RecordResource | null>(null);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  async function open(uuid: string): Promise<void> {
    isLoading.value = true;
    loadError.value = null;
    record.value = null;

    try {
      record.value = await fetchRecord(uuid);
      if (!record.value) {
        loadError.value = "Record not found. It may have been removed.";
      }
    } catch (fetchError) {
      console.error("[useRecordDetail] open error:", fetchError);
      loadError.value = "Failed to load record. Please try again.";
    } finally {
      isLoading.value = false;
    }
  }

  function close(): void {
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
