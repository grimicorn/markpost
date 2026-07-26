import { and, count, desc, eq, ilike, like, lt, or, SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { records, RECORD_STATUSES } from "../../db/schema";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import { buildRecordListResponse, parsePageSize } from "../../utils/pagination";
import type { RecordListApiResponse } from "../../utils/response";
import {
  isSourceType,
  SOURCE_TYPES,
  type SourceType,
} from "#shared/utils/sourceTypes";

type Database = ReturnType<typeof getDb>;

type CursorPosition = {
  createdAt: Date;
  uuid: string;
};

type RecordFilters = {
  source?: SourceType;
  status?: string;
  query?: string;
};

// Escapes the wildcard characters `%`, `_`, and `\` so user-supplied search
// text is matched literally rather than as a LIKE/ILIKE pattern.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

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

function invalidSourceFilterError(): ApiError {
  return new ApiError(
    [
      {
        status: "400",
        title: "Invalid filter[source]",
        detail: `filter[source] must be one of: ${SOURCE_TYPES.join(", ")}`,
        source: { parameter: "filter[source]" },
      },
    ],
    400,
  );
}

function validateSourceFilter(
  filterSource: string | undefined,
): SourceType | undefined {
  if (!filterSource) {
    return undefined;
  }

  if (!isSourceType(filterSource)) {
    throw invalidSourceFilterError();
  }

  return filterSource;
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

  if (filters.query) {
    conditions.push(
      ilike(records.title, `%${escapeLikePattern(filters.query)}%`),
    );
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
      const filterQuery = query["filter[q]"] as string | undefined;

      const validatedSource = validateSourceFilter(filterSource);

      const validatedStatus = RECORD_STATUSES.includes(
        filterStatus as (typeof RECORD_STATUSES)[number],
      )
        ? filterStatus
        : undefined;

      const trimmedQuery = filterQuery?.trim();

      const filters: RecordFilters = {
        source: validatedSource,
        status: validatedStatus,
        query: trimmedQuery ? trimmedQuery : undefined,
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
