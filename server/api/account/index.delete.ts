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

// Cancel billing by Stripe customer, not the stored subscription id: a
// subscription created outside checkout or a stale row after a missed webhook
// would otherwise keep billing after the account is gone. Runs before the DB
// delete so the customer id is still on the row (it cascades away with it); the
// sweep is idempotent, so a retry after a later failure is safe.
async function cancelBillingForUser(userId: string): Promise<void> {
  const subscription = await findSubscriptionByUserId(userId);
  const customerId = subscription?.stripeCustomerId ?? null;
  if (!customerId) {
    return;
  }

  await cancelSubscriptionsForCustomer(customerId);
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
