import { EXPORT_ROW_LIMIT } from "#shared/utils/export";

export const RECORD_EXPORT_LIMIT = EXPORT_ROW_LIMIT;
// Callers fetch one row beyond the limit so buildRecordExport can detect
// truncation; exported so the fetch size can't drift from the check.
export const RECORD_EXPORT_FETCH_LIMIT = RECORD_EXPORT_LIMIT + 1;

export type RecordExportRow = {
  uuid: string;
  createdAt: string;
  title: string;
  content: string;
  source: string | null;
  sourceId: string | null;
  status: string;
  filePath: string | null;
  tags: unknown;
  frontmatter: unknown;
  syncedAt: string | null;
  errorMessage: string | null;
};

type RecordExportInput = Omit<RecordExportRow, "createdAt" | "syncedAt"> & {
  createdAt: Date;
  syncedAt: Date | null;
};

export type RecordExport = {
  rows: RecordExportRow[];
  isTruncated: boolean;
};

function serializeRecordRow(row: RecordExportInput): RecordExportRow {
  return {
    uuid: row.uuid,
    createdAt: row.createdAt.toISOString(),
    title: row.title,
    content: row.content,
    source: row.source,
    sourceId: row.sourceId,
    status: row.status,
    filePath: row.filePath,
    tags: row.tags,
    frontmatter: row.frontmatter,
    syncedAt: row.syncedAt ? row.syncedAt.toISOString() : null,
    errorMessage: row.errorMessage,
  };
}

// Builds the record export payload from raw rows: caps the set at
// RECORD_EXPORT_LIMIT, flags truncation when the caller fetched one extra row
// beyond the limit, and serializes timestamps to ISO strings.
export function buildRecordExport(rows: RecordExportInput[]): RecordExport {
  const isTruncated = rows.length > RECORD_EXPORT_LIMIT;
  const visibleRows = isTruncated ? rows.slice(0, RECORD_EXPORT_LIMIT) : rows;

  return {
    rows: visibleRows.map(serializeRecordRow),
    isTruncated,
  };
}
