import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { records } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";
import {
  buildRecordExport,
  RECORD_EXPORT_FETCH_LIMIT,
  RECORD_EXPORT_FILENAME,
} from "../../utils/recordExport";

export default defineEventHandler(async (event) => {
  try {
    const userId = requireUser(event);
    const db = getDb();

    const rows = await db
      .select()
      .from(records)
      .where(eq(records.userId, userId))
      .orderBy(desc(records.createdAt), desc(records.uuid))
      .limit(RECORD_EXPORT_FETCH_LIMIT);

    const exportPayload = buildRecordExport(rows);

    setHeader(event, "Content-Type", "application/json");
    setHeader(
      event,
      "Content-Disposition",
      `attachment; filename="${RECORD_EXPORT_FILENAME}"`,
    );
    // Full dump of the user's private record bodies; keep it out of shared
    // browser/proxy caches so it isn't recoverable after logout.
    setHeader(event, "Cache-Control", "no-store, private");
    setHeader(event, "X-Export-Truncated", String(exportPayload.isTruncated));

    return exportPayload.rows;
  } catch (error) {
    return apiErrorHandler(error);
  }
});
