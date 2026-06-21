import { and, count, desc, eq, lt, or } from "drizzle-orm";
import { getDb } from "../../db";
import { records } from "../../db/schema";
import { apiErrorHandler } from "../../utils/errors";
import { buildRecordListResponse, parsePageSize } from "../../utils/pagination";
import type { RecordListApiResponse } from "../../utils/response";

type Database = ReturnType<typeof getDb>;

type CursorPosition = {
  createdAt: Date;
  uuid: string;
};

async function findCursorPosition(
  db: Database,
  userId: string,
  afterUuid: string,
): Promise<CursorPosition | null> {
  const [cursorRecord] = await db
    .select({ createdAt: records.createdAt, uuid: records.uuid })
    .from(records)
    .where(and(eq(records.userId, userId), eq(records.uuid, afterUuid)))
    .limit(1);

  return cursorRecord ?? null;
}

async function resolveCursor(
  db: Database,
  userId: string,
  afterUuid: string | undefined,
): Promise<CursorPosition | null> {
  if (!afterUuid) {
    return null;
  }

  return findCursorPosition(db, userId, afterUuid);
}

function buildCursorFilter(userId: string, cursor: CursorPosition | null) {
  const ownerFilter = eq(records.userId, userId);
  if (!cursor) {
    return ownerFilter;
  }

  const beforeCursor = or(
    lt(records.createdAt, cursor.createdAt),
    and(eq(records.createdAt, cursor.createdAt), lt(records.uuid, cursor.uuid)),
  );

  return and(ownerFilter, beforeCursor);
}

async function countUserRecords(db: Database, userId: string): Promise<number> {
  const [totalRow] = await db
    .select({ value: count() })
    .from(records)
    .where(eq(records.userId, userId));

  return totalRow?.value ?? 0;
}

function fetchRecordsPage(
  db: Database,
  userId: string,
  cursor: CursorPosition | null,
  size: number,
) {
  return db
    .select()
    .from(records)
    .where(buildCursorFilter(userId, cursor))
    .orderBy(desc(records.createdAt), desc(records.uuid))
    .limit(size + 1);
}

export default defineEventHandler(
  async (event): Promise<RecordListApiResponse> => {
    try {
      const userId = requireUser(event);
      const db = getDb();

      const query = getQuery(event);
      const size = parsePageSize(query["page[size]"] as string | undefined);
      const afterUuid = query["page[after]"] as string | undefined;

      const cursor = await resolveCursor(db, userId, afterUuid);
      const total = await countUserRecords(db, userId);
      const pageRecords = await fetchRecordsPage(db, userId, cursor, size);

      return buildRecordListResponse({
        records: pageRecords,
        size,
        total,
        prevCursor: afterUuid ?? null,
      });
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
