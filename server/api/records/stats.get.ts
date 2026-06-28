import { count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { records, RECORD_STATUSES } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";

type RecordStats = {
  syncedToday: number;
  pending: number;
  errors: number;
  thisMonth: number;
};

type StatsApiResponse = {
  data: RecordStats;
};

const [STATUS_SYNCED, STATUS_PENDING, STATUS_ERROR] = RECORD_STATUSES;

function startOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function startOfMonthUtcIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

async function fetchRecordStats(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<RecordStats> {
  const todayStartIso = startOfTodayUtcIso();
  const monthStartIso = startOfMonthUtcIso();

  const rows = await db
    .select({
      syncedToday: count(
        sql`CASE WHEN ${isNotNull(records.syncedAt)} AND ${gte(records.syncedAt, todayStartIso)} THEN 1 END`,
      ),
      pending: count(
        sql`CASE WHEN ${records.status} = ${STATUS_PENDING} THEN 1 END`,
      ),
      errors: count(
        sql`CASE WHEN ${records.status} = ${STATUS_ERROR} THEN 1 END`,
      ),
      thisMonth: count(
        sql`CASE WHEN ${gte(records.createdAt, monthStartIso)} THEN 1 END`,
      ),
    })
    .from(records)
    .where(eq(records.userId, userId));

  const row = rows[0];

  return {
    syncedToday: Number(row?.syncedToday ?? 0),
    pending: Number(row?.pending ?? 0),
    errors: Number(row?.errors ?? 0),
    thisMonth: Number(row?.thisMonth ?? 0),
  };
}

export default defineEventHandler(async (event): Promise<StatsApiResponse> => {
  try {
    const userId = requireUser(event);
    const db = getDb();
    const fetchedStats = await fetchRecordStats(db, userId);
    return { data: fetchedStats };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
