import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  downloadExport,
  exportOutcomeToNotice,
  saveBlobAsFile,
  type ExportDownloadDeps,
} from "../../app/utils/exportDownload";

const EXPORT_URL = "/api/records/export";
const FILENAME = "markpost-records.json";

function buildResponse(
  overrides: {
    ok?: boolean;
    status?: number;
    truncated?: string | null;
    contentType?: string | null;
    blob?: Blob;
  } = {},
): Response {
  const {
    ok = true,
    status = ok ? 200 : 500,
    truncated = "false",
    contentType = "application/json",
    blob = new Blob(["[]"]),
  } = overrides;
  const headers = new Headers();
  if (contentType !== null) {
    headers.set("Content-Type", contentType);
  }
  if (truncated !== null) {
    headers.set("X-Export-Truncated", truncated);
  }
  return {
    ok,
    status,
    headers,
    blob: vi.fn().mockResolvedValue(blob),
  } as unknown as Response;
}

function buildDeps(response: Response): {
  deps: ExportDownloadDeps;
  saveFile: ReturnType<typeof vi.fn>;
  fetchFn: ReturnType<typeof vi.fn>;
} {
  const saveFile = vi.fn();
  const fetchFn = vi.fn().mockResolvedValue(response);
  return { deps: { fetchFn, saveFile }, saveFile, fetchFn };
}

describe("downloadExport", () => {
  it("returns success and saves the blob when the header is false", async () => {
    const blob = new Blob(["[]"]);
    const { deps, saveFile, fetchFn } = buildDeps(
      buildResponse({ truncated: "false", blob }),
    );

    const outcome = await downloadExport(EXPORT_URL, FILENAME, deps);

    expect(outcome).toEqual({ status: "success" });
    expect(fetchFn).toHaveBeenCalledWith(
      EXPORT_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(saveFile).toHaveBeenCalledWith(blob, FILENAME);
  });

  it("returns truncated when the header is true", async () => {
    const { deps, saveFile } = buildDeps(buildResponse({ truncated: "true" }));

    const outcome = await downloadExport(EXPORT_URL, FILENAME, deps);

    expect(outcome).toEqual({ status: "truncated" });
    // A truncated export is still a real (capped) file — it must still download.
    expect(saveFile).toHaveBeenCalledOnce();
  });

  it("fails closed to truncated when the header is absent", async () => {
    // A stripped header can't prove completeness — warn rather than stay silent.
    const { deps } = buildDeps(buildResponse({ truncated: null }));

    const outcome = await downloadExport(EXPORT_URL, FILENAME, deps);

    expect(outcome).toEqual({ status: "truncated" });
  });

  it("detects truncation regardless of header casing", async () => {
    const { deps } = buildDeps(buildResponse({ truncated: "True" }));

    const outcome = await downloadExport(EXPORT_URL, FILENAME, deps);

    expect(outcome).toEqual({ status: "truncated" });
  });

  it("returns unauthorized when a non-JSON page is served in place of the export", async () => {
    const { deps, saveFile } = buildDeps(
      buildResponse({ contentType: "text/html" }),
    );

    const outcome = await downloadExport(EXPORT_URL, FILENAME, deps);

    expect(outcome).toEqual({ status: "unauthorized" });
    expect(saveFile).not.toHaveBeenCalled();
  });

  it("returns error and does not save when the response is not ok", async () => {
    const { deps, saveFile } = buildDeps(buildResponse({ ok: false }));

    const outcome = await downloadExport(EXPORT_URL, FILENAME, deps);

    expect(outcome).toEqual({ status: "error" });
    expect(saveFile).not.toHaveBeenCalled();
  });

  it("returns unauthorized on a 401 and does not save", async () => {
    const { deps, saveFile } = buildDeps(
      buildResponse({ ok: false, status: 401 }),
    );

    const outcome = await downloadExport(EXPORT_URL, FILENAME, deps);

    expect(outcome).toEqual({ status: "unauthorized" });
    expect(saveFile).not.toHaveBeenCalled();
  });

  it("returns error when reading the blob body fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const saveFile = vi.fn();
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({
        "Content-Type": "application/json",
        "X-Export-Truncated": "false",
      }),
      blob: vi.fn().mockRejectedValue(new Error("body read failed")),
    } as unknown as Response;
    const fetchFn = vi.fn().mockResolvedValue(response);

    const outcome = await downloadExport(EXPORT_URL, FILENAME, {
      fetchFn,
      saveFile,
    });

    expect(outcome).toEqual({ status: "error" });
    expect(saveFile).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns error when the fetch rejects", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const saveFile = vi.fn();
    const fetchFn = vi.fn().mockRejectedValue(new Error("network down"));

    const outcome = await downloadExport(EXPORT_URL, FILENAME, {
      fetchFn,
      saveFile,
    });

    expect(outcome).toEqual({ status: "error" });
    expect(saveFile).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("exportOutcomeToNotice", () => {
  it("returns null for a full success", () => {
    expect(exportOutcomeToNotice({ status: "success" })).toBeNull();
  });

  it("returns a warn notice for a truncated export", () => {
    const notice = exportOutcomeToNotice({ status: "truncated" });
    expect(notice?.tone).toBe("warn");
    expect(notice?.message).toContain("left out");
  });

  it("returns an err notice for a failed export", () => {
    const notice = exportOutcomeToNotice({ status: "error" });
    expect(notice?.tone).toBe("err");
  });

  it("returns a session-expired notice for an unauthorized export", () => {
    const notice = exportOutcomeToNotice({ status: "unauthorized" });
    expect(notice?.tone).toBe("err");
    expect(notice?.title).toBe("Session expired");
  });
});

describe("saveBlobAsFile", () => {
  const OBJECT_URL = "blob:mock-url";
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let clickedAnchor: HTMLAnchorElement | null;

  beforeEach(() => {
    vi.useFakeTimers();
    clickedAnchor = null;
    createObjectUrl = vi.fn().mockReturnValue(OBJECT_URL);
    revokeObjectUrl = vi.fn();
    // jsdom implements neither of these; provide stubs so the seam is exercised.
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectUrl,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectUrl,
      writable: true,
      configurable: true,
    });
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedAnchor = this;
      });
  });

  afterEach(() => {
    clickSpy.mockRestore();
    vi.useRealTimers();
  });

  it("clicks an anchor carrying the object URL and filename, then cleans up", () => {
    const blob = new Blob(["[]"]);

    saveBlobAsFile(blob, FILENAME);

    expect(createObjectUrl).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(clickedAnchor?.download).toBe(FILENAME);
    expect(clickedAnchor?.href).toContain(OBJECT_URL);
    expect(document.querySelector("a")).toBeNull();
  });

  it("defers revoking the object URL until after the current tick", () => {
    saveBlobAsFile(new Blob(["[]"]), FILENAME);

    // Revoking in the same tick as click() cancels the download in some browsers.
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revokeObjectUrl).toHaveBeenCalledWith(OBJECT_URL);
  });
});
