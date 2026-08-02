import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useBillingSettings,
  redirectToBillingUrl,
} from "../../app/composables/useBillingSettings";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

const SAMPLE_USAGE = {
  recordsCreatedThisMonth: 284,
  connectedSourceCount: 2,
  plan: "pro" as const,
  status: "trialing" as const,
  trialEndsAt: "2026-07-10T00:00:00Z",
  trialDaysLeft: 9,
  trialPercentElapsed: 64,
};

function makeNotFoundError(): Error {
  return Object.assign(new Error("Not Found"), { statusCode: 404 });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useBillingSettings", () => {
  describe("load()", () => {
    it("sets usage from the API response on success", async () => {
      mockFetch.mockResolvedValueOnce({ data: SAMPLE_USAGE });

      const { usage, load } = useBillingSettings();
      await load();

      expect(usage.value).toEqual(SAMPLE_USAGE);
      expect(mockFetch).toHaveBeenCalledWith("/api/billing/usage");
    });

    it("sets isLoading to true during the request and false after", async () => {
      let capturedDuringLoad = false;
      mockFetch.mockImplementationOnce(async () => {
        capturedDuringLoad = true;
        return { data: SAMPLE_USAGE };
      });

      const { isLoading, load } = useBillingSettings();
      const promise = load();
      expect(isLoading.value).toBe(true);
      await promise;
      expect(isLoading.value).toBe(false);
      expect(capturedDuringLoad).toBe(true);
    });

    it("sets loadError when the fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));

      const { loadError, usage, load } = useBillingSettings();
      await load();

      expect(loadError.value).toBe("Failed to load billing details.");
      expect(usage.value).toBeNull();
    });

    it("does not start a second load while one is in flight", async () => {
      let resolveFirst!: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      );

      const { load } = useBillingSettings();
      const firstLoad = load();
      const secondLoad = load();
      resolveFirst({ data: SAMPLE_USAGE });
      await Promise.all([firstLoad, secondLoad]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("addPaymentMethod()", () => {
    let originalLocation: Location;

    beforeEach(() => {
      originalLocation = window.location;
      Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });

    it("redirects to the Customer Portal URL when one is returned", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { url: "https://billing.stripe.com/session/abc" },
      });

      const { addPaymentMethod } = useBillingSettings();
      await addPaymentMethod();

      expect(mockFetch).toHaveBeenCalledWith("/api/billing/portal", {
        method: "POST",
      });
      expect(window.location.href).toBe(
        "https://billing.stripe.com/session/abc",
      );
    });

    it("falls back to Checkout when the portal 404s (no Stripe customer yet)", async () => {
      mockFetch
        .mockRejectedValueOnce(makeNotFoundError())
        .mockResolvedValueOnce({
          data: { url: "https://checkout.stripe.com/session/xyz" },
        });

      const { addPaymentMethod } = useBillingSettings();
      await addPaymentMethod();

      expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/billing/portal", {
        method: "POST",
      });
      expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/billing/checkout", {
        method: "POST",
        body: { priceKey: "pro" },
      });
      expect(window.location.href).toBe(
        "https://checkout.stripe.com/session/xyz",
      );
    });

    it("sets redirectError when the portal fails with a non-404 error", async () => {
      const serverError = Object.assign(new Error("Server Error"), {
        statusCode: 500,
        data: { errors: [{ detail: "Stripe is unavailable." }] },
      });
      mockFetch.mockRejectedValueOnce(serverError);

      const { redirectError, addPaymentMethod } = useBillingSettings();
      await addPaymentMethod();

      expect(redirectError.value).toBe("Stripe is unavailable.");
      expect(window.location.href).toBe("");
    });

    it("sets redirectError when the Checkout fallback also fails", async () => {
      mockFetch
        .mockRejectedValueOnce(makeNotFoundError())
        .mockRejectedValueOnce(new Error("network error"));

      const { redirectError, addPaymentMethod } = useBillingSettings();
      await addPaymentMethod();

      expect(redirectError.value).toBe(
        "Failed to start a billing session. Please try again.",
      );
    });

    it("sets isRedirecting to true during the request and false after", async () => {
      let capturedDuringRedirect = false;
      mockFetch.mockImplementationOnce(async () => {
        capturedDuringRedirect = true;
        return { data: { url: "https://billing.stripe.com/session/abc" } };
      });

      const { isRedirecting, addPaymentMethod } = useBillingSettings();
      const promise = addPaymentMethod();
      expect(isRedirecting.value).toBe(true);
      await promise;
      expect(isRedirecting.value).toBe(false);
      expect(capturedDuringRedirect).toBe(true);
    });

    it("does not start a second redirect while one is in flight", async () => {
      let resolveFirst!: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      );

      const { addPaymentMethod } = useBillingSettings();
      const firstCall = addPaymentMethod();
      const secondCall = addPaymentMethod();
      resolveFirst({ data: { url: "https://billing.stripe.com/session/abc" } });
      await Promise.all([firstCall, secondCall]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe("redirectToBillingUrl", () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("sets window.location.href to the given URL", () => {
    redirectToBillingUrl("https://billing.stripe.com/session/abc");
    expect(window.location.href).toBe("https://billing.stripe.com/session/abc");
  });
});
