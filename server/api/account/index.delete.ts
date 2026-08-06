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

// Cancel billing by Stripe customer, not the stored subscription id: an extra
// subscription created outside checkout, or a stale local row after a missed
// webhook, would otherwise keep billing after the account is gone. Runs before
// the DB delete so the customer id is still on the row (it cascades away with
// it); the sweep is idempotent, so a retry after a later failure is safe.
async function cancelBillingForUser(userId: string): Promise<void> {
  const subscription = await findSubscriptionByUserId(userId);
  const customerId = subscription?.stripeCustomerId ?? null;
  // No row / no customer id means checkout never linked a Stripe customer to
  // this user, so there's nothing to sweep by. Log the skip rather than swallow
  // it: if a webhook was missed entirely, billing could still be live under a
  // customer id we can no longer recover locally.
  if (!customerId) {
    console.warn("[account] no Stripe customer on file; skipping sweep", {
      userId,
    });
    return;
  }

  const { canceledCount } = await cancelSubscriptionsForCustomer(customerId);
  console.info("[account] canceled Stripe subscriptions on account delete", {
    userId,
    canceledCount,
  });
}

export default defineEventHandler(
  async (event): Promise<{ meta: { deleted: true } }> => {
    try {
      const userId = requireUser(event);
      await cancelBillingForUser(userId);
      // Delete app data before the Clerk identity: the users-row delete is
      // idempotent, so a retry after a Clerk failure safely no-ops the DB side.
      await deleteAllUserData(userId);
      await deleteClerkUser(userId);
      return { meta: { deleted: true } };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
