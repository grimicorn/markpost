import {
  EXPORT_ROW_LIMIT,
  EXPORT_TRUNCATED_HEADER,
  EXPORT_TRUNCATED_HEADER_TRUE,
} from "#shared/utils/export";

// Abort a stalled download so `isExporting` can't stay stuck true (which would
// disable the export button until a page reload); AbortSignal.timeout rejects,
// and the catch below maps that to an `error` outcome.
const EXPORT_TIMEOUT_MS = 60_000;

export type ExportOutcome =
  | { status: "success" }
  | { status: "truncated" }
  | { status: "unauthorized" }
  | { status: "error" };

// requireUser() answers an expired/absent session with 401; surfaced as a
// distinct outcome so the user is told to sign in rather than to "try again".
const UNAUTHORIZED_STATUS = 401;

// The export endpoints always respond with JSON. A 200 that is anything else
// means an auth proxy served a sign-in/interstitial HTML page in place of the
// export — treat that as an expired session, not a downloadable file.
const CONTENT_TYPE_HEADER = "content-type";
const EXPORT_CONTENT_TYPE = "application/json";

export type ExportNotice = {
  tone: "warn" | "err";
  title: string;
  message: string;
};

// "rows" (not "records"/"events") so the same copy serves both exports. The
// message states the fact rather than advising "narrow the list": neither
// export endpoint accepts a filter, so re-exporting yields the same file.
const TRUNCATED_NOTICE: ExportNotice = {
  tone: "warn",
  title: "Export truncated",
  message: `Only the most recent ${EXPORT_ROW_LIMIT.toLocaleString()} rows were included; older rows were left out.`,
};

const ERROR_NOTICE: ExportNotice = {
  tone: "err",
  title: "Export failed",
  message: "The export couldn't be generated. Please try again.",
};

const SESSION_EXPIRED_NOTICE: ExportNotice = {
  tone: "err",
  title: "Session expired",
  message: "Your session expired. Sign in again, then retry the export.",
};

// External DOM seam: turns a fetched Blob into a browser "save file" prompt.
// Isolated so the download flow can be unit tested by injecting a stub —
// jsdom implements neither URL.createObjectURL nor a real anchor download.
export function saveBlobAsFile(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Defer the revoke: revoking in the same tick as click() cancels the
    // download in Firefox/Safari before the browser has read the blob.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

export type ExportDownloadDeps = {
  fetchFn: typeof fetch;
  saveFile: (blob: Blob, filename: string) => void;
};

// Raw `fetch` rather than the app's `$fetch`: this download needs the raw
// Blob body plus explicit status/header inspection (200 vs 401 vs other), and
// $fetch throws on any non-2xx, which would collapse those branches into one
// catch. Wrapped in an arrow so the global keeps its binding when injected.
const defaultDeps: ExportDownloadDeps = {
  fetchFn: (input, init) => fetch(input, init),
  saveFile: saveBlobAsFile,
};

// Fail closed: the whole point of this feature is that a short export must not
// pass as complete. An absent header (a proxy stripped it) can't prove the
// export is whole, so warn rather than stay silent; casing is normalized so a
// header-rewriting proxy ("True") can't defeat the check either.
function isTruncatedResponse(response: Response): boolean {
  const header = response.headers.get(EXPORT_TRUNCATED_HEADER);

  if (header === null) {
    return true;
  }

  return header.toLowerCase() === EXPORT_TRUNCATED_HEADER_TRUE;
}

function isJsonResponse(response: Response): boolean {
  // Content-Type is case-insensitive per RFC 9110; normalize like the
  // truncation check does so a rewriting proxy can't defeat it.
  const contentType =
    response.headers.get(CONTENT_TYPE_HEADER)?.toLowerCase() ?? "";
  return contentType.startsWith(EXPORT_CONTENT_TYPE);
}

// Fetches an export endpoint as a blob and triggers a browser download.
// Unlike a `window.location` navigation, a fetch reads the response headers, so
// the X-Export-Truncated signal is surfaced to the caller instead of silently
// dropped. Never throws — failures map to an `error` outcome the UI can toast.
// The whole payload is buffered in memory (bounded server-side by the export
// row limit); that's an accepted cost of needing the headers before the save.
export async function downloadExport(
  url: string,
  filename: string,
  deps: ExportDownloadDeps = defaultDeps,
): Promise<ExportOutcome> {
  try {
    const response = await deps.fetchFn(url, {
      signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
    });

    if (response.status === UNAUTHORIZED_STATUS) {
      return { status: "unauthorized" };
    }

    if (!response.ok) {
      return { status: "error" };
    }

    if (!isJsonResponse(response)) {
      return { status: "unauthorized" };
    }

    const truncated = isTruncatedResponse(response);
    const blob = await response.blob();
    deps.saveFile(blob, filename);

    return truncated ? { status: "truncated" } : { status: "success" };
  } catch (error) {
    console.error("[exportDownload] download failed:", error);
    return { status: "error" };
  }
}

// Maps a download outcome to the alert a page should show, or null when the
// export succeeded in full and needs no notice. Shared so the inbox and
// activity pages present truncation/error identically.
export function exportOutcomeToNotice(
  outcome: ExportOutcome,
): ExportNotice | null {
  if (outcome.status === "unauthorized") {
    return SESSION_EXPIRED_NOTICE;
  }

  if (outcome.status === "error") {
    return ERROR_NOTICE;
  }

  if (outcome.status === "truncated") {
    return TRUNCATED_NOTICE;
  }

  return null;
}
