import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { users, type SubscriptionStatus } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { deleteClerkUser } from "../../utils/clerk";
import { apiErrorHandler, ApiError } from "../../utils/errors";
import { findSubscriptionByUserId } from "../../utils/billing";
import { cancelSubscription } from "../../services/stripe";

const CANCELED_STATUS: SubscriptionStatus = "canceled";

function billingUnavailableError(): ApiError {
  return new ApiError(
    [
      {
        status: "503",
        title: "Service Unavailable",
        detail:
          "Could not cancel your subscription, so your account was not deleted. Please try again.",
      },
    ],
    503,
  );
}

// Cancels the customer's live Stripe subscription before any local state is
// wiped. The subscriptions row holds the id we need and is deleted by the
// users-row cascade below, so once that runs we can no longer reconcile — a
// Pro user would keep being charged. A genuine Stripe failure here aborts the
// whole delete (fail closed) so we never remove the account while billing is
// still live.
async function cancelActiveSubscription(userId: string): Promise<void> {
  const subscription = await findSubscriptionByUserId(userId);

  if (!subscription?.stripeSubscriptionId) {
    return;
  }

  if (subscription.status === CANCELED_STATUS) {
    return;
  }

  try {
    await cancelSubscription(subscription.stripeSubscriptionId);
  } catch (error) {
    console.error("[account/delete] Stripe subscription cancel failed", {
      userId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      error,
    });
    throw billingUnavailableError();
  }
}

async function deleteAllUserData(userId: string): Promise<void> {
  // Deleting the users row cascades to every user-owned table (api_tokens,
  // sources, records, events, user_settings, subscriptions) via their
  // ON DELETE cascade FKs.
  await getDb().delete(users).where(eq(users.userId, userId));
}

export default defineEventHandler(
  async (event): Promise<{ meta: { deleted: true } }> => {
    try {
      const userId = requireUser(event);
      await cancelActiveSubscription(userId);
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
