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
// was already deleted, or the id is stale). Cancelling something that's already
// gone is a no-op, not a failure — we must not block account deletion on it.
const STRIPE_RESOURCE_MISSING_CODE = "resource_missing";
const STRIPE_NOT_FOUND_STATUS = 404;

function isSubscriptionAlreadyGone(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError)) {
    return false;
  }

  return (
    error.code === STRIPE_RESOURCE_MISSING_CODE ||
    error.statusCode === STRIPE_NOT_FOUND_STATUS
  );
}

export type CancelSubscriptionResult = {
  // true when Stripe had no live subscription to cancel (already gone). Callers
  // can treat this as success without proving a fresh cancellation happened.
  alreadyGone: boolean;
};

// Cancels a live subscription immediately. Swallows only the "already gone"
// case so account deletion isn't blocked by a stale id; any other Stripe error
// (network, auth, a subscription that genuinely failed to cancel) propagates so
// we never silently leave a customer billed.
export async function cancelSubscription(
  subscriptionId: string,
): Promise<CancelSubscriptionResult> {
  const stripe = getStripeClient();

  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return { alreadyGone: false };
  } catch (error) {
    if (isSubscriptionAlreadyGone(error)) {
      return { alreadyGone: true };
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
