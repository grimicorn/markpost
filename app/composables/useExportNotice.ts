import {
  exportOutcomeToNotice,
  type ExportNotice,
  type ExportOutcome,
} from "../utils/exportDownload";

// Drives an export button: guards against concurrent downloads, clears the
// previous notice before a new run, and maps the outcome to the alert both the
// inbox and activity pages render. `run` never rejects — even an unexpected
// throw from the trigger surfaces as the error notice, so a failed export can
// never leave the button stuck with no feedback.
export function useExportNotice(triggerDownload: () => Promise<ExportOutcome>) {
  const notice = ref<ExportNotice | null>(null);
  const isExporting = ref(false);

  async function run(): Promise<void> {
    if (isExporting.value) {
      return;
    }

    isExporting.value = true;
    notice.value = null;

    try {
      notice.value = exportOutcomeToNotice(await triggerDownload());
    } catch (error) {
      console.error("[useExportNotice] export failed:", error);
      notice.value = exportOutcomeToNotice({ status: "error" });
    } finally {
      isExporting.value = false;
    }
  }

  return { notice, isExporting, run };
}
