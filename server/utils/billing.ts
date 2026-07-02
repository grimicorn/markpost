import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  subscriptions,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "../db/schema";

export type SubscriptionRow = {
  id: string;
  userId: string;
  plan: string;
  status: string;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertSubscriptionInput = {
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

export async function findSubscriptionByUserId(
  userId: string,
): Promise<SubscriptionRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return row ?? null;
}

export async function findSubscriptionByStripeCustomerId(
  stripeCustomerId: string,
): Promise<SubscriptionRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);

  return row ?? null;
}

export async function upsertSubscription(
  input: UpsertSubscriptionInput,
): Promise<void> {
  const db = getDb();
  await db
    .insert(subscriptions)
    .values({
      userId: input.userId,
      plan: input.plan,
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        plan: input.plan,
        status: input.status,
        trialEndsAt: input.trialEndsAt,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        updatedAt: new Date(),
      },
    });
}

export async function updateSubscriptionByStripeCustomerId(
  stripeCustomerId: string,
  updates: {
    plan?: SubscriptionPlan;
    status: SubscriptionStatus;
    trialEndsAt?: Date | null;
    stripeSubscriptionId?: string;
    onlyIfSubscriptionId?: string;
  },
): Promise<void> {
  const db = getDb();

  const { onlyIfSubscriptionId, ...updateFields } = updates;

  const whereClause = onlyIfSubscriptionId
    ? and(
        eq(subscriptions.stripeCustomerId, stripeCustomerId),
        eq(subscriptions.stripeSubscriptionId, onlyIfSubscriptionId),
      )
    : eq(subscriptions.stripeCustomerId, stripeCustomerId);

  const updated = await db
    .update(subscriptions)
    .set({
      ...updateFields,
      updatedAt: new Date(),
    })
    .where(whereClause)
    .returning({ id: subscriptions.id });

  if (updated.length === 0) {
    console.warn(
      "[billing] updateSubscriptionByStripeCustomerId: no row found for customer",
      { stripeCustomerId, onlyIfSubscriptionId },
    );
  }
}

function buildProPriceIdSet(): Set<string> {
  const monthlyId = process.env.STRIPE_PRO_PRICE_ID ?? "";
  const annualId = process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "";
  const ids = new Set<string>();

  if (monthlyId) {
    ids.add(monthlyId);
  }

  if (annualId) {
    ids.add(annualId);
  }

  return ids;
}

export function resolvePlanFromPriceId(
  priceId: string | null,
): SubscriptionPlan {
  if (!priceId) {
    return "hobby";
  }

  const proPriceIds = buildProPriceIdSet();

  if (proPriceIds.has(priceId)) {
    return "pro";
  }

  return "hobby";
}

export function resolveStatusFromStripe(
  stripeStatus: string,
): SubscriptionStatus {
  const validStatuses: Set<SubscriptionStatus> = new Set([
    "active",
    "trialing",
    "past_due",
    "canceled",
    "incomplete",
  ]);

  if (validStatuses.has(stripeStatus as SubscriptionStatus)) {
    return stripeStatus as SubscriptionStatus;
  }

  return "incomplete";
}

export function isValidPlan(value: string): value is SubscriptionPlan {
  return (SUBSCRIPTION_PLANS as readonly string[]).includes(value);
}
