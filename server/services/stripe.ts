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

// Stripe subscription statuses that can't transition further and reject a
// cancel call (see Subscription.Status). Everything else is still billable and
// must be swept on account deletion.
const TERMINAL_SUBSCRIPTION_STATUSES: ReadonlySet<Stripe.Subscription.Status> =
  new Set(["canceled", "incomplete_expired"]);

// Page size for the customer subscription sweep. Stripe caps list at 100.
const SUBSCRIPTION_SWEEP_PAGE_SIZE = 100;

// The narrow slice of the Stripe subscriptions API the sweep depends on, so the
// cancellation logic can be unit-tested with a fake in place of a live client.
export type SubscriptionGateway = {
  list: (
    params: Stripe.SubscriptionListParams,
  ) => Promise<Stripe.ApiList<Stripe.Subscription>>;
  cancel: (subscriptionId: string) => Promise<Stripe.Subscription>;
};

export type CustomerCancelResult = {
  canceledCount: number;
};

function toSubscriptionGateway(stripe: Stripe): SubscriptionGateway {
  return {
    list: (params) => stripe.subscriptions.list(params),
    cancel: (subscriptionId) => stripe.subscriptions.cancel(subscriptionId),
  };
}

function isTerminalStatus(status: Stripe.Subscription.Status): boolean {
  return TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}

// A cancel can race a concurrent cancellation (webhook, portal). Stripe reports
// an already-gone or already-canceled subscription as resource_missing or an
// invalid_request naming the canceled status; both mean the goal is met.
function isAlreadyCanceledError(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError)) {
    return false;
  }

  if (error.code === "resource_missing") {
    return true;
  }

  const message = error.message ?? "";
  return (
    error.type === "StripeInvalidRequestError" && message.includes("canceled")
  );
}

async function cancelSubscription(
  gateway: SubscriptionGateway,
  subscriptionId: string,
): Promise<void> {
  try {
    await gateway.cancel(subscriptionId);
  } catch (error) {
    if (isAlreadyCanceledError(error)) {
      return;
    }
    throw error;
  }
}

async function cancelIfBillable(
  gateway: SubscriptionGateway,
  subscription: Stripe.Subscription,
): Promise<number> {
  if (isTerminalStatus(subscription.status)) {
    return 0;
  }

  await cancelSubscription(gateway, subscription.id);
  return 1;
}

async function cancelPage(
  gateway: SubscriptionGateway,
  page: Stripe.Subscription[],
): Promise<number> {
  let canceledCount = 0;

  for (const subscription of page) {
    canceledCount += await cancelIfBillable(gateway, subscription);
  }

  return canceledCount;
}

function nextCursor(page: Stripe.ApiList<Stripe.Subscription>): string | null {
  if (!page.has_more) {
    return null;
  }

  return page.data[page.data.length - 1]?.id ?? null;
}

// Sweep every subscription Stripe holds for the customer and cancel each
// non-terminal one, paginating until exhausted. Isolated from the live client
// (takes a SubscriptionGateway) so it can be unit-tested without Stripe.
export async function sweepCustomerSubscriptions(
  gateway: SubscriptionGateway,
  customerId: string,
): Promise<CustomerCancelResult> {
  let canceledCount = 0;
  let startingAfter: string | null = null;

  do {
    const page = await gateway.list({
      customer: customerId,
      status: "all",
      limit: SUBSCRIPTION_SWEEP_PAGE_SIZE,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    canceledCount += await cancelPage(gateway, page.data);
    startingAfter = nextCursor(page);
  } while (startingAfter);

  return { canceledCount };
}

// Cancel every billable subscription for a Stripe customer, not just a stored
// subscription id: a subscription created outside checkout, or a stale local
// row after a missed webhook, would otherwise keep billing. Idempotent and
// tolerant of already-canceled/terminal subscriptions.
export async function cancelSubscriptionsForCustomer(
  customerId: string,
): Promise<CustomerCancelResult> {
  const gateway = toSubscriptionGateway(getStripeClient());
  return sweepCustomerSubscriptions(gateway, customerId);
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
