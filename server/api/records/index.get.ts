import { and, count, desc, eq, like, lt, or, SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { records, RECORD_STATUSES } from "../../db/schema";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import { buildRecordListResponse, parsePageSize } from "../../utils/pagination";
import type { RecordListApiResponse } from "../../utils/response";

const ALLOWED_SOURCE_TYPES = ["webhook", "email"] as const;
type AllowedSourceType = (typeof ALLOWED_SOURCE_TYPES)[number];

type Database = ReturnType<typeof getDb>;

type CursorPosition = {
  createdAt: Date;
  uuid: string;
};

type RecordFilters = {
  source?: AllowedSourceType;
  status?: string;
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

  const cursor = await findCursorPosition(db, userId, afterUuid);
  if (!cursor) {
    throw new ApiError(
      [
        {
          status: "400",
          title: "Invalid cursor",
          detail: `Record '${afterUuid}' not found or not accessible`,
        },
      ],
      400,
    );
  }

  return cursor;
}

function buildFilterConditions(
  userId: string,
  cursor: CursorPosition | null,
  filters: RecordFilters,
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(records.userId, userId)];

  if (filters.source) {
    conditions.push(like(records.source, `${filters.source}/%`));
  }

  if (filters.status) {
    conditions.push(eq(records.status, filters.status));
  }

  if (cursor) {
    const beforeCursor = or(
      lt(records.createdAt, cursor.createdAt),
      and(
        eq(records.createdAt, cursor.createdAt),
        lt(records.uuid, cursor.uuid),
      ),
    );
    conditions.push(beforeCursor);
  }

  return and(...conditions);
}

async function countFilteredRecords(
  db: Database,
  userId: string,
  filters: RecordFilters,
): Promise<number> {
  const [totalRow] = await db
    .select({ value: count() })
    .from(records)
    .where(buildFilterConditions(userId, null, filters));

  return totalRow?.value ?? 0;
}

function fetchRecordsPage(
  db: Database,
  userId: string,
  cursor: CursorPosition | null,
  size: number,
  filters: RecordFilters,
) {
  return db
    .select()
    .from(records)
    .where(buildFilterConditions(userId, cursor, filters))
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
      const filterSource = query["filter[source]"] as string | undefined;
      const filterStatus = query["filter[status]"] as string | undefined;

      const validatedSource = ALLOWED_SOURCE_TYPES.includes(
        filterSource as AllowedSourceType,
      )
        ? (filterSource as AllowedSourceType)
        : undefined;

      const validatedStatus = RECORD_STATUSES.includes(
        filterStatus as (typeof RECORD_STATUSES)[number],
      )
        ? filterStatus
        : undefined;

      const filters: RecordFilters = {
        source: validatedSource,
        status: validatedStatus,
      };

      const cursor = await resolveCursor(db, userId, afterUuid);
      const total = await countFilteredRecords(db, userId, filters);
      const pageRecords = await fetchRecordsPage(
        db,
        userId,
        cursor,
        size,
        filters,
      );

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
