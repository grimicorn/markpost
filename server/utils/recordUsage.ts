import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "../db";
import { records } from "../db/schema";

// Start of the current calendar month in UTC. Records are attributed to a month
// by createdAt, so both the enforced cap (server/utils/planLimits.ts) and the
// displayed usage (server/api/billing/usage.get.ts) resolve the boundary here.
export function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// The single definition of "records this month", used by BOTH the plan-limit
// enforcement and the billing usage dashboard so the number shown to the user
// can never disagree with the number actually enforced (issue #130).
//
// Counts by createdAt, not syncedAt: webhook ingestion
// (server/api/hooks/[slug].post.ts) inserts records without ever setting
// syncedAt, so a syncedAt-based count would both under-report on the dashboard
// and let that write path bypass the cap.
//
// Counts current rows, so a deleted record frees up quota within the same month
// (this tracks "records currently attributed to this month", not a strictly
// monotonic creation counter). Records have no delete-tracking column, so a
// monotonic counter would need a separate ledger — out of scope here.
export async function countRecordsCreatedThisMonth(
  userId: string,
): Promise<number> {
  const db = getDb();
  const monthStart = startOfMonthUtc();

  const [row] = await db
    .select({ total: count() })
    .from(records)
    .where(and(eq(records.userId, userId), gte(records.createdAt, monthStart)));

  return Number(row?.total ?? 0);
}
