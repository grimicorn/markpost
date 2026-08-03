import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── Stripe SDK mock ─────────────────────────────────────────────────────────
// Mock the raw `stripe` package so cancelSubscription can be exercised without
// hitting the network. The mock exposes the same `errors.StripeError` class the
// real SDK throws, so the service's `instanceof` guard behaves identically.

const mockRetrieve = vi.fn();
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
    subscriptions = { retrieve: mockRetrieve, cancel: mockCancel };
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

// getStripeClient caches the client at module scope, so the secret only has to
// be present the first time it builds a client — set it once for the suite.
beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cancelSubscription", () => {
  it("cancels a live subscription by id", async () => {
    mockRetrieve.mockResolvedValueOnce({
      id: SUBSCRIPTION_ID,
      status: "active",
    });
    mockCancel.mockResolvedValueOnce({ id: SUBSCRIPTION_ID });

    await cancelSubscription(SUBSCRIPTION_ID);

    expect(mockRetrieve).toHaveBeenCalledWith(SUBSCRIPTION_ID);
    expect(mockCancel).toHaveBeenCalledWith(SUBSCRIPTION_ID);
  });

  it("does not re-cancel a subscription Stripe already considers canceled", async () => {
    mockRetrieve.mockResolvedValueOnce({
      id: SUBSCRIPTION_ID,
      status: "canceled",
    });

    await cancelSubscription(SUBSCRIPTION_ID);

    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("does not cancel an incomplete_expired subscription", async () => {
    mockRetrieve.mockResolvedValueOnce({
      id: SUBSCRIPTION_ID,
      status: "incomplete_expired",
    });

    await cancelSubscription(SUBSCRIPTION_ID);

    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("treats a resource_missing Stripe error as already gone", async () => {
    mockRetrieve.mockRejectedValueOnce(
      new MockStripeError({ code: "resource_missing" }),
    );

    await expect(cancelSubscription(SUBSCRIPTION_ID)).resolves.toBeUndefined();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("treats a 404 Stripe error as already gone", async () => {
    mockRetrieve.mockRejectedValueOnce(
      new MockStripeError({ statusCode: 404 }),
    );

    await expect(cancelSubscription(SUBSCRIPTION_ID)).resolves.toBeUndefined();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("rethrows a real Stripe error from retrieve so the caller never silently succeeds", async () => {
    mockRetrieve.mockRejectedValueOnce(
      new MockStripeError({ code: "api_error", statusCode: 500 }),
    );

    await expect(cancelSubscription(SUBSCRIPTION_ID)).rejects.toBeInstanceOf(
      MockStripeError,
    );
  });

  it("treats a resource_missing error raised by cancel (retrieve/cancel race) as a no-op", async () => {
    mockRetrieve.mockResolvedValueOnce({
      id: SUBSCRIPTION_ID,
      status: "active",
    });
    mockCancel.mockRejectedValueOnce(
      new MockStripeError({ code: "resource_missing" }),
    );

    await expect(cancelSubscription(SUBSCRIPTION_ID)).resolves.toBeUndefined();
    expect(mockCancel).toHaveBeenCalledWith(SUBSCRIPTION_ID);
  });

  it("treats a 400 repeat-cancel as a no-op when a re-check shows the subscription went terminal", async () => {
    mockRetrieve
      .mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "active" })
      .mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "canceled" });
    mockCancel.mockRejectedValueOnce(
      new MockStripeError({ code: "invalid_request_error", statusCode: 400 }),
    );

    await expect(cancelSubscription(SUBSCRIPTION_ID)).resolves.toBeUndefined();
    expect(mockRetrieve).toHaveBeenCalledTimes(2);
  });

  it("rethrows a real Stripe error raised by cancel when a re-check shows it is still live", async () => {
    mockRetrieve
      .mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "active" })
      .mockResolvedValueOnce({ id: SUBSCRIPTION_ID, status: "active" });
    mockCancel.mockRejectedValueOnce(
      new MockStripeError({ code: "api_error", statusCode: 500 }),
    );

    await expect(cancelSubscription(SUBSCRIPTION_ID)).rejects.toBeInstanceOf(
      MockStripeError,
    );
  });

  it("rethrows a non-Stripe error", async () => {
    mockRetrieve.mockRejectedValueOnce(new Error("network down"));

    await expect(cancelSubscription(SUBSCRIPTION_ID)).rejects.toThrow(
      "network down",
    );
  });
});
