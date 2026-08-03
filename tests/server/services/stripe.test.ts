import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Stripe SDK mock ─────────────────────────────────────────────────────────
// Mock the raw `stripe` package so cancelSubscription can be exercised without
// hitting the network. The mock exposes the same `errors.StripeError` class the
// real SDK throws, so the service's `instanceof` guard behaves identically.

const mockCancel = vi.fn();

class MockStripeError extends Error {
  code?: string;
  statusCode?: number;

  constructor(props: { message?: string; code?: string; statusCode?: number }) {
    super(props.message ?? "stripe error");
    this.code = props.code;
    this.statusCode = props.statusCode;
  }
}

vi.mock("stripe", () => {
  class StripeMock {
    subscriptions = { cancel: mockCancel };
  }

  return {
    default: Object.assign(StripeMock, {
      errors: { StripeError: MockStripeError },
    }),
  };
});

// ── Import AFTER the mock ────────────────────────────────────────────────────

const { cancelSubscription } = await import("../../../server/services/stripe");

const SUBSCRIPTION_ID = "sub_test_123";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
});

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
});

describe("cancelSubscription", () => {
  it("cancels the subscription by id", async () => {
    mockCancel.mockResolvedValueOnce({ id: SUBSCRIPTION_ID });

    const result = await cancelSubscription(SUBSCRIPTION_ID);

    expect(mockCancel).toHaveBeenCalledWith(SUBSCRIPTION_ID);
    expect(result).toEqual({ alreadyGone: false });
  });

  it("treats a resource_missing Stripe error as already gone", async () => {
    mockCancel.mockRejectedValueOnce(
      new MockStripeError({ code: "resource_missing" }),
    );

    const result = await cancelSubscription(SUBSCRIPTION_ID);

    expect(result).toEqual({ alreadyGone: true });
  });

  it("treats a 404 Stripe error as already gone", async () => {
    mockCancel.mockRejectedValueOnce(new MockStripeError({ statusCode: 404 }));

    const result = await cancelSubscription(SUBSCRIPTION_ID);

    expect(result).toEqual({ alreadyGone: true });
  });

  it("rethrows a real Stripe error so the caller never silently succeeds", async () => {
    mockCancel.mockRejectedValueOnce(
      new MockStripeError({ code: "api_error", statusCode: 500 }),
    );

    await expect(cancelSubscription(SUBSCRIPTION_ID)).rejects.toBeInstanceOf(
      MockStripeError,
    );
  });

  it("rethrows a non-Stripe error", async () => {
    mockCancel.mockRejectedValueOnce(new Error("network down"));

    await expect(cancelSubscription(SUBSCRIPTION_ID)).rejects.toThrow(
      "network down",
    );
  });
});
