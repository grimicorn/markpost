import { count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { records, sources } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";

type BillingUsage = {
  recordsSyncedThisMonth: number;
  connectedSourceCount: number;
};

type BillingUsageApiResponse = {
  data: BillingUsage;
};

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function fetchRecordsSyncedThisMonth(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<number> {
  const monthStart = startOfMonthUtc();

  const rows = await db
    .select({
      total: count(
        sql`CASE WHEN ${isNotNull(records.syncedAt)} AND ${gte(records.syncedAt, monthStart)} THEN 1 END`,
      ),
    })
    .from(records)
    .where(eq(records.userId, userId));

  return Number(rows[0]?.total ?? 0);
}

async function fetchConnectedSourceCount(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(sources)
    .where(eq(sources.userId, userId));

  return Number(rows[0]?.total ?? 0);
}

export default defineEventHandler(
  async (event): Promise<BillingUsageApiResponse> => {
    try {
      const userId = requireUser(event);
      const db = getDb();

      const [recordsSyncedThisMonth, connectedSourceCount] = await Promise.all([
        fetchRecordsSyncedThisMonth(db, userId),
        fetchConnectedSourceCount(db, userId),
      ]);

      return {
        data: {
          recordsSyncedThisMonth,
          connectedSourceCount,
        },
      };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
