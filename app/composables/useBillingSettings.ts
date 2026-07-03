import { fetchBillingUsage, type BillingUsage } from "./useBillingUsage";
import { extractErrorDetail } from "../utils/apiError";

type BillingLinkApiResponse = {
  data: { url: string };
};

// The Checkout endpoint (server/api/billing/checkout.post.ts) requires a
// priceKey. "pro" is the monthly plan and is the sensible default when a
// user has no existing Stripe customer to send to the Customer Portal.
const DEFAULT_CHECKOUT_PRICE_KEY = "pro";

const NOT_FOUND_STATUS_CODE = 404;

// Isolate the external HTTP calls to the billing API in small, mockable
// functions so the redirect flow below can be unit tested without a network.
function isNoStripeCustomerError(error: unknown): boolean {
  const fetchError = error as { statusCode?: number };
  return fetchError?.statusCode === NOT_FOUND_STATUS_CODE;
}

async function requestPortalUrl(): Promise<string | null> {
  try {
    const response = await $fetch<BillingLinkApiResponse>(
      "/api/billing/portal",
      { method: "POST" },
    );
    return response.data.url;
  } catch (error) {
    // No Stripe customer yet (e.g. still on the free Hobby plan) — fall back
    // to Checkout instead of surfacing this as an error.
    if (isNoStripeCustomerError(error)) {
      return null;
    }
    throw error;
  }
}

async function requestCheckoutUrl(): Promise<string> {
  const response = await $fetch<BillingLinkApiResponse>(
    "/api/billing/checkout",
    {
      method: "POST",
      body: { priceKey: DEFAULT_CHECKOUT_PRICE_KEY },
    },
  );
  return response.data.url;
}

// Isolated the same way useEvents.ts isolates triggerExportDownload, so tests
// can stub window.location instead of letting the browser actually navigate.
export function redirectToBillingUrl(url: string): void {
  window.location.href = url;
}

export function useBillingSettings() {
  const usage = ref<BillingUsage | null>(null);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  const isRedirecting = ref(false);
  const redirectError = ref<string | null>(null);

  async function load(): Promise<void> {
    if (isLoading.value) {
      return;
    }

    isLoading.value = true;
    loadError.value = null;

    const result = await fetchBillingUsage();

    if (result === null) {
      loadError.value = "Failed to load billing details.";
      isLoading.value = false;
      return;
    }

    usage.value = result;
    isLoading.value = false;
  }

  async function addPaymentMethod(): Promise<void> {
    if (isRedirecting.value) {
      return;
    }

    isRedirecting.value = true;
    redirectError.value = null;

    try {
      const portalUrl = await requestPortalUrl();
      const url = portalUrl ?? (await requestCheckoutUrl());
      redirectToBillingUrl(url);
    } catch (error) {
      console.error("[useBillingSettings] addPaymentMethod failed:", error);
      redirectError.value = extractErrorDetail(
        error,
        "Failed to start a billing session. Please try again.",
      );
    } finally {
      isRedirecting.value = false;
    }
  }

  return {
    usage,
    isLoading,
    loadError,
    isRedirecting,
    redirectError,
    load,
    addPaymentMethod,
  };
}
