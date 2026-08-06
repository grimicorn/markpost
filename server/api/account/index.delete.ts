import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { cancelSubscriptionsForCustomer } from "../../services/stripe";
import { requireUser } from "../../utils/auth";
import { findSubscriptionByUserId } from "../../utils/billing";
import { deleteClerkUser } from "../../utils/clerk";
import { apiErrorHandler } from "../../utils/errors";

async function deleteAllUserData(userId: string): Promise<void> {
  // Deleting the users row cascades to every user-owned table (api_tokens,
  // sources, records, events, user_settings) via their ON DELETE cascade FKs.
  await getDb().delete(users).where(eq(users.userId, userId));
}

// Cancel Stripe billing for the account (see cancelSubscriptionsForCustomer for
// why by-customer, not by-stored-id). Runs before the DB delete so the customer
// id is still on the row — it cascades away with it. Returns whether a sweep
// actually ran, so the caller can flag the (irreversible) canceled-billing but
// account-not-deleted state if a later delete step fails.
async function cancelBillingForUser(userId: string): Promise<boolean> {
  const subscription = await findSubscriptionByUserId(userId);
  // No subscription row means checkout never linked a Stripe customer; a free
  // user delete, nothing to sweep. Warn (not error) so it doesn't cry wolf.
  if (!subscription) {
    console.warn("[account] no subscription row; skipping Stripe sweep", {
      userId,
    });
    return false;
  }

  // A row with no customer id should not happen (upsertSubscription always sets
  // it). Log at error so the broken row is visible rather than swallowed.
  if (!subscription.stripeCustomerId) {
    console.error(
      "[account] subscription row missing Stripe customer id; skipping sweep",
      { userId },
    );
    return false;
  }

  const { canceledCount } = await cancelSubscriptionsForCustomer(
    subscription.stripeCustomerId,
  );
  console.info("[account] canceled Stripe subscriptions on account delete", {
    userId,
    canceledCount,
  });
  return true;
}

// Delete app data before the Clerk identity: the users-row delete is
// idempotent, so a retry after a Clerk failure safely no-ops the DB side. If a
// step fails after billing was swept, flag it: the user is still active but
// their subscriptions are already (irreversibly) canceled.
async function deleteAccount(
  userId: string,
  billingSwept: boolean,
): Promise<void> {
  try {
    await deleteAllUserData(userId);
    await deleteClerkUser(userId);
  } catch (error) {
    if (billingSwept) {
      console.error(
        "[account] billing canceled but account delete failed; user still active",
        { userId },
      );
    }
    throw error;
  }
}

export default defineEventHandler(
  async (event): Promise<{ meta: { deleted: true } }> => {
    try {
      const userId = requireUser(event);
      const billingSwept = await cancelBillingForUser(userId);
      await deleteAccount(userId, billingSwept);
      return { meta: { deleted: true } };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
