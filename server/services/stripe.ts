import Stripe from "stripe";
import { TRIAL_PERIOD_DAYS } from "../utils/billing";

const STRIPE_SECRET_KEY_ENV = "STRIPE_SECRET_KEY";

let cachedStripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (cachedStripeClient) {
    return cachedStripeClient;
  }

  const secretKey = process.env[STRIPE_SECRET_KEY_ENV];
  if (!secretKey) {
    throw new Error(`${STRIPE_SECRET_KEY_ENV} is not set`);
  }

  cachedStripeClient = new Stripe(secretKey);
  return cachedStripeClient;
}

export type CheckoutSessionOptions = {
  customerId: string | null;
  customerEmail: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
  isReturningCustomer: boolean;
};

export type CheckoutSessionResult = {
  url: string;
};

export async function createCheckoutSession(
  options: CheckoutSessionOptions,
): Promise<CheckoutSessionResult> {
  const stripe = getStripeClient();

  const subscriptionData: Stripe.Checkout.SessionCreateParams["subscription_data"] =
    {
      metadata: { userId: options.userId },
    };

  if (!options.isReturningCustomer) {
    subscriptionData.trial_period_days = TRIAL_PERIOD_DAYS;
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: options.priceId, quantity: 1 }],
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    client_reference_id: options.userId,
    subscription_data: subscriptionData,
    metadata: { userId: options.userId },
  };

  if (options.customerId) {
    sessionParams.customer = options.customerId;
  } else if (options.customerEmail) {
    sessionParams.customer_email = options.customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error("Stripe checkout session created without a URL");
  }

  return { url: session.url };
}

// Stripe returns this error code when the subscription no longer exists (it
// was already deleted, or the id is stale). A retrieve/cancel against something
// that's already gone is a no-op, not a failure — it must not block account
// deletion.
const STRIPE_RESOURCE_MISSING_CODE = "resource_missing";

// Terminal Stripe statuses can't be cancelled again — attempting it raises a
// 400. Treat a subscription already in one of these as "nothing live to
// cancel" so a stale local row (e.g. a delayed subscription.deleted webhook)
// never wedges account deletion.
const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "incomplete_expired",
]);

// A `resource_missing`/404 isn't only "already deleted" — it also fires when a
// misconfigured key (e.g. test-mode against live ids) can't see the
// subscription, which would fail open and keep billing the customer. Log the
// error metadata (including Stripe's requestId) so the skipped-cancel path is
// observable and traceable rather than silent.
function warnAlreadyGone(
  subscriptionId: string,
  error: Stripe.errors.StripeError,
): void {
  console.warn("[stripe] subscription already gone; skipped cancel", {
    subscriptionId,
    code: error.code,
    statusCode: error.statusCode,
    requestId: error.requestId,
  });
}

// Match on Stripe's `resource_missing` code specifically, not a bare 404:
// Stripe always sets this code when a subscription doesn't exist, and keying on
// the code avoids swallowing an unrelated 404 (proxy/gateway) as "already gone"
// on the one path that then irreversibly deletes a possibly-still-billed account.
function isSubscriptionAlreadyGone(
  error: unknown,
): error is Stripe.errors.StripeError {
  if (!(error instanceof Stripe.errors.StripeError)) {
    return false;
  }

  return error.code === STRIPE_RESOURCE_MISSING_CODE;
}

// Resolves true when the subscription is already terminal or no longer exists —
// either way there is nothing live to cancel. Swallows a missing/404 retrieve
// as "gone"; any other retrieve error propagates.
async function isNothingToCancel(
  stripe: Stripe,
  subscriptionId: string,
): Promise<boolean> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status);
  } catch (error) {
    if (isSubscriptionAlreadyGone(error)) {
      warnAlreadyGone(subscriptionId, error);
      return true;
    }

    throw error;
  }
}

// Cancels a live subscription immediately. Retrieves first so a subscription
// Stripe already considers terminal (already-cancelled, expired) or missing
// resolves as a no-op rather than triggering Stripe's 400/404 on cancel. Any
// other Stripe error (network, auth) propagates so we never silently leave a
// customer billed.
export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  const stripe = getStripeClient();

  if (await isNothingToCancel(stripe, subscriptionId)) {
    return;
  }

  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    if (isSubscriptionAlreadyGone(error)) {
      warnAlreadyGone(subscriptionId, error);
      return;
    }

    // Retrieve and cancel aren't atomic: the subscription can reach a terminal
    // state between the two (portal cancel, dunning, trial expiry), and the
    // repeat-cancel then errors (a 400, not a 404). Re-check strictly — only an
    // explicitly retrieved terminal status is a no-op. If the re-read itself
    // fails we don't actually know the state, so surface the ORIGINAL cancel
    // error rather than letting a transient 404 mask a live subscription.
    const current = await stripe.subscriptions
      .retrieve(subscriptionId)
      .catch(() => null);

    if (current && TERMINAL_SUBSCRIPTION_STATUSES.has(current.status)) {
      return;
    }

    throw error;
  }
}

export type CustomerPortalOptions = {
  customerId: string;
  returnUrl: string;
};

export type CustomerPortalResult = {
  url: string;
};

export async function createCustomerPortalSession(
  options: CustomerPortalOptions,
): Promise<CustomerPortalResult> {
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: options.customerId,
    return_url: options.returnUrl,
  });

  return { url: session.url };
}

export function constructStripeEvent(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    rawBody,
    signatureHeader,
    webhookSecret,
  );
}

export type SubscriptionEventData = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string;
  priceId: string | null;
  trialEnd: number | null;
  userId: string | null;
};

export function extractSubscriptionData(
  subscription: Stripe.Subscription,
): SubscriptionEventData {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const userId =
    subscription.metadata?.userId ?? subscription.metadata?.user_id ?? null;

  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    status: subscription.status,
    priceId,
    trialEnd: subscription.trial_end,
    userId,
  };
}
