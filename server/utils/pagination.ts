import {
  paginationLinks,
  paginationMeta,
  recordSerializer,
  type RecordListApiResponse,
} from "./response";

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 100;

type ListableRecord = {
  uuid: string;
  createdAt: Date;
  userId: string;
  title: string;
  content: string;
};

type RecordListInput = {
  records: ListableRecord[];
  size: number;
  total: number;
  prevCursor: string | null;
};

export function parsePageSize(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_PAGE_SIZE;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(parsed, MAX_PAGE_SIZE);
}

export function buildRecordListResponse(
  input: RecordListInput,
): RecordListApiResponse {
  const hasMore = input.records.length > input.size;
  const pageRecords = hasMore
    ? input.records.slice(0, input.size)
    : input.records;

  const data = pageRecords
    .map((record) => recordSerializer(record))
    .filter((resource) => resource !== null);

  const lastRecord = pageRecords.at(-1);
  const afterCursor = lastRecord ? lastRecord.uuid : null;

  return {
    data,
    meta: paginationMeta({ total: input.total, size: input.size, hasMore }),
    links: paginationLinks({
      afterCursor,
      prevCursor: input.prevCursor,
      size: input.size,
      hasMore,
    }),
  };
}
