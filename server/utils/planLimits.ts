import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "../db";
import { records, sources, type SubscriptionPlan } from "../db/schema";
import {
  HOBBY_CONNECTED_SOURCE_LIMIT,
  HOBBY_MONTHLY_RECORD_LIMIT,
} from "../../shared/utils/planLimits";
import { findSubscriptionByUserId } from "./billing";
import { ApiError } from "./errors";

const HOBBY_PLAN: SubscriptionPlan = "hobby";
// A user with no subscription row is treated the same as an explicit Hobby
// subscription everywhere else in the app (see usage.get.ts DEFAULT_PLAN).
const DEFAULT_PLAN: SubscriptionPlan = "hobby";

async function resolveUserPlan(userId: string): Promise<SubscriptionPlan> {
  const subscription = await findSubscriptionByUserId(userId);
  return (subscription?.plan as SubscriptionPlan | undefined) ?? DEFAULT_PLAN;
}

function planLimitError(limitDescription: string): ApiError {
  return new ApiError(
    [
      {
        status: "403",
        title: "Plan Limit Reached",
        detail: `You've reached the Hobby plan limit of ${limitDescription}. Upgrade to Pro for unlimited usage.`,
      },
    ],
    403,
  );
}

type LimitCheck = {
  userId: string;
  limit: number;
  limitDescription: string;
  countCurrent: (userId: string) => Promise<number>;
};

// Single reusable gate behind assertWithinRecordLimit / assertWithinSourceLimit
// below, so the "resolve plan, skip non-Hobby, count, compare, throw" sequence
// exists in exactly one place rather than once per write path.
async function assertWithinLimit(check: LimitCheck): Promise<void> {
  const plan = await resolveUserPlan(check.userId);

  if (plan !== HOBBY_PLAN) {
    return;
  }

  const currentCount = await check.countCurrent(check.userId);

  if (currentCount >= check.limit) {
    throw planLimitError(check.limitDescription);
  }
}

function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Counts every record created this month, not just synced ones. Webhook
// ingestion (server/api/hooks/[slug].post.ts) inserts records without ever
// setting syncedAt, so gating on syncedAt (as the usage.get.ts display metric
// does) would let that write path bypass the cap entirely.
async function countRecordsCreatedThisMonth(userId: string): Promise<number> {
  const db = getDb();
  const monthStart = startOfMonthUtc();

  const [row] = await db
    .select({ total: count() })
    .from(records)
    .where(and(eq(records.userId, userId), gte(records.createdAt, monthStart)));

  return Number(row?.total ?? 0);
}

async function countConnectedSources(userId: string): Promise<number> {
  const db = getDb();

  const [row] = await db
    .select({ total: count() })
    .from(sources)
    .where(eq(sources.userId, userId));

  return Number(row?.total ?? 0);
}

// Enforce on every record write path: server/api/records/index.post.ts (direct
// API create) and server/api/hooks/[slug].post.ts (webhook ingest).
export async function assertWithinRecordLimit(userId: string): Promise<void> {
  await assertWithinLimit({
    userId,
    limit: HOBBY_MONTHLY_RECORD_LIMIT,
    limitDescription: `${HOBBY_MONTHLY_RECORD_LIMIT} records synced per month`,
    countCurrent: countRecordsCreatedThisMonth,
  });
}

// Enforce on the source write path: server/api/sources/index.post.ts.
export async function assertWithinSourceLimit(userId: string): Promise<void> {
  const sourceWord =
    HOBBY_CONNECTED_SOURCE_LIMIT === 1
      ? "connected source"
      : "connected sources";

  await assertWithinLimit({
    userId,
    limit: HOBBY_CONNECTED_SOURCE_LIMIT,
    limitDescription: `${HOBBY_CONNECTED_SOURCE_LIMIT} ${sourceWord}`,
    countCurrent: countConnectedSources,
  });
}
