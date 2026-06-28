import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { events } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";

const EXPORT_LIMIT = 10_000;
const EXPORT_FILENAME = "markpost-activity.json";

type ExportRow = {
  id: string;
  ts: string;
  kind: string;
  message: string;
  recordUuid: string | null;
  sourceId: string | null;
};

function serializeExportRow(row: {
  id: string;
  ts: Date;
  kind: string;
  message: string;
  recordUuid: string | null;
  sourceId: string | null;
}): ExportRow {
  return {
    id: row.id,
    ts: row.ts.toISOString(),
    kind: row.kind,
    message: row.message,
    recordUuid: row.recordUuid,
    sourceId: row.sourceId,
  };
}

export default defineEventHandler(async (event) => {
  try {
    const userId = requireUser(event);
    const db = getDb();

    const rows = await db
      .select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(desc(events.ts), desc(events.id))
      .limit(EXPORT_LIMIT);

    const exportRows = rows.map(serializeExportRow);

    setHeader(event, "Content-Type", "application/json");
    setHeader(
      event,
      "Content-Disposition",
      `attachment; filename="${EXPORT_FILENAME}"`,
    );

    return exportRows;
  } catch (error) {
    return apiErrorHandler(error);
  }
});
