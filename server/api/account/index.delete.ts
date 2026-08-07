import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { deleteClerkUser } from "../../utils/clerk";
import { apiErrorHandler, ApiError } from "../../utils/errors";
import { findSubscriptionByUserId } from "../../utils/billing";
import { cancelSubscription } from "../../services/stripe";

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
// Pro user would keep being charged. The Stripe service owns the "is this still
// live" decision (it no-ops on already-cancelled/missing subscriptions); a
// genuine Stripe failure aborts the whole delete (fail closed) so we never
// remove the account while billing is still live. Returns the subscription id
// we acted on (or null) so the caller can flag an irreversible partial failure.
async function cancelActiveSubscription(
  userId: string,
): Promise<string | null> {
  const subscription = await findSubscriptionByUserId(userId);

  if (!subscription?.stripeSubscriptionId) {
    return null;
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

  return subscription.stripeSubscriptionId;
}

async function deleteAllUserData(userId: string): Promise<void> {
  // Deleting the users row cascades to every user-owned table (api_tokens,
  // sources, records, events, user_settings, subscriptions) via their
  // ON DELETE cascade FKs.
  await getDb().delete(users).where(eq(users.userId, userId));
}

// Deletes local app data then the Clerk identity. If this fails after the
// Stripe subscription was already cancelled, the account is left live with a
// dead subscription — log it loudly so support can reconcile, then rethrow.
async function deleteUserRecords(
  userId: string,
  canceledSubscriptionId: string | null,
): Promise<void> {
  try {
    // Delete app data before the Clerk identity: the users-row delete is
    // idempotent, so a retry after a Clerk failure safely no-ops the DB side.
    await deleteAllUserData(userId);
    await deleteClerkUser(userId);
  } catch (error) {
    if (canceledSubscriptionId) {
      console.error(
        "[account/delete] subscription cancelled but account deletion failed; reconcile manually",
        { userId, canceledSubscriptionId },
      );
    }
    throw error;
  }
}

export default defineEventHandler(
  async (event): Promise<{ meta: { deleted: true } }> => {
    try {
      const userId = requireUser(event);
      const canceledSubscriptionId = await cancelActiveSubscription(userId);
      await deleteUserRecords(userId, canceledSubscriptionId);
      return { meta: { deleted: true } };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
