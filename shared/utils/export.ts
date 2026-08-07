// Shared between the export endpoints (server/api/records/export.get.ts,
// server/api/events/export.get.ts) and the client download helper
// (app/utils/exportDownload.ts). Kept here so the header name and file names
// can never drift between the server that sets them and the client that reads
// them. Nuxt auto-resolves `shared/` for both layers — import via `#shared`,
// never a relative path.

// Set to "true" by the export endpoints when the result was capped at the row
// limit. A `window.location` download never sees response headers, so the
// client reads this via a fetch+blob download to warn the user data was left
// out (see app/utils/exportDownload.ts).
export const EXPORT_TRUNCATED_HEADER = "X-Export-Truncated";
export const EXPORT_TRUNCATED_HEADER_TRUE = "true";

// The row cap both export endpoints enforce. Shared so the server limit and the
// client's truncation message reference one number instead of duplicate literals.
export const EXPORT_ROW_LIMIT = 10_000;

export const RECORDS_EXPORT_FILENAME = "markpost-records.json";
export const ACTIVITY_EXPORT_FILENAME = "markpost-activity.json";
