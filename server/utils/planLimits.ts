import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "../db";
import { records, sources, type SubscriptionPlan } from "../db/schema";
import {
  HOBBY_CONNECTED_SOURCE_LIMIT,
  HOBBY_MONTHLY_RECORD_LIMIT,
} from "../../shared/utils/planLimits";
import { findSubscriptionByUserId } from "./billing";
import { ApiError } from "./errors";

// A user with no subscription row is treated the same as an explicit Hobby
// subscription everywhere else in the app (see usage.get.ts DEFAULT_PLAN).
const DEFAULT_PLAN: SubscriptionPlan = "hobby";

// Explicit allowlist of plans exempt from the cap, checked with .includes()
// rather than "plan !== HOBBY_PLAN". A negative check is fail-open: any
// unexpected value in the `plan` column (a legacy tier, a bad backfill — the
// column is plain `text`, not a DB-enforced enum) would silently disable
// enforcement. This allowlist fails closed instead: only a plan explicitly
// known to be unlimited skips the cap.
const UNLIMITED_PLANS: readonly SubscriptionPlan[] = ["pro"];

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
//
// This is a best-effort, read-then-write check, not an atomic guarantee: two
// concurrent requests can both read a count under the limit and both insert,
// letting a Hobby user land one row over the advertised cap in a race. A hard
// guarantee would need a DB-level constraint (e.g. a partial unique index for
// the 1-source case); that's a schema change and out of scope here, so this
// intentionally accepts a small, self-correcting overshoot in exchange for
// keeping the enforcement isolated to a single read + compare.
async function assertWithinLimit(check: LimitCheck): Promise<void> {
  const plan = await resolveUserPlan(check.userId);

  if (UNLIMITED_PLANS.includes(plan)) {
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
//
// @todo this createdAt-based count is intentionally a different (stricter,
// harder to bypass) metric than the syncedAt-based "recordsSyncedThisMonth"
// shown on the billing usage dashboard (server/api/billing/usage.get.ts). A
// Hobby user can therefore be blocked here while the dashboard still shows
// them under 100 synced. Reconciling that — e.g. surfacing a
// recordsCreatedThisMonth stat on BillingUsage so the UI matches what's
// enforced — is a dashboard/API contract change beyond this issue's scope
// (server-side write-path enforcement); track it as a follow-up.
//
// This counts current rows, so a deleted record frees up quota within the
// same month (the cap tracks "records currently attributed to this month",
// not a strictly monotonic creation counter). Records have no delete-tracking
// column to distinguish "never existed" from "created and later removed", so
// a stricter monotonic counter would need a separate ledger — out of scope
// here; this still closes the unlimited-creation bug the issue reports.
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
    // "records per month" (not "records synced per month"): the count below
    // includes not-yet-synced records too, so the wording must not imply the
    // narrower syncedAt-based metric shown on the billing usage dashboard.
    limitDescription: `${HOBBY_MONTHLY_RECORD_LIMIT} records per month`,
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
