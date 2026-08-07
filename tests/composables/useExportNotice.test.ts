import { describe, it, expect, vi } from "vitest";
import { useExportNotice } from "../../app/composables/useExportNotice";
import type { ExportOutcome } from "../../app/utils/exportDownload";

function triggerResolving(outcome: ExportOutcome) {
  return vi.fn<() => Promise<ExportOutcome>>().mockResolvedValue(outcome);
}

describe("useExportNotice", () => {
  it("maps a truncated outcome to a warn notice", async () => {
    const { notice, run } = useExportNotice(
      triggerResolving({ status: "truncated" }),
    );

    await run();

    expect(notice.value?.tone).toBe("warn");
  });

  it("leaves no notice on a full success", async () => {
    const { notice, run } = useExportNotice(
      triggerResolving({ status: "success" }),
    );

    await run();

    expect(notice.value).toBeNull();
  });

  it("surfaces an error notice when the trigger rejects", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const trigger = vi
      .fn<() => Promise<ExportOutcome>>()
      .mockRejectedValue(new Error("boom"));

    const { notice, isExporting, run } = useExportNotice(trigger);
    await run();

    expect(notice.value?.tone).toBe("err");
    expect(isExporting.value).toBe(false);
    consoleError.mockRestore();
  });

  it("clears the previous notice when a new export starts", async () => {
    const trigger = vi
      .fn<() => Promise<ExportOutcome>>()
      .mockResolvedValueOnce({ status: "truncated" })
      .mockResolvedValueOnce({ status: "success" });

    const { notice, run } = useExportNotice(trigger);

    await run();
    expect(notice.value).not.toBeNull();

    await run();
    expect(notice.value).toBeNull();
  });

  it("ignores a concurrent run while one is in flight", async () => {
    let resolveTrigger!: (outcome: ExportOutcome) => void;
    const trigger = vi.fn<() => Promise<ExportOutcome>>().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTrigger = resolve;
        }),
    );

    const { run, isExporting } = useExportNotice(trigger);
    const firstRun = run();
    expect(isExporting.value).toBe(true);

    await run();
    expect(trigger).toHaveBeenCalledOnce();

    resolveTrigger({ status: "success" });
    await firstRun;
    expect(isExporting.value).toBe(false);
  });
});
