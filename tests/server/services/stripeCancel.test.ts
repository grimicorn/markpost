import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercises the live-client wiring of cancelSubscriptionsForCustomer: the real
// getStripeClient/toSubscriptionGateway path, with the Stripe SDK itself mocked
// so no network call happens. Guards the method mapping (list/cancel) and the
// error sanitization that keeps raw Stripe errors off the wire.

const listMock = vi.fn();
const cancelMock = vi.fn();

class StripeErrorStub extends Error {}

vi.mock("stripe", () => {
  class StripeStub {
    subscriptions = { list: listMock, cancel: cancelMock };
    static errors = { StripeError: StripeErrorStub };
  }
  return { default: StripeStub };
});

const { cancelSubscriptionsForCustomer } =
  await import("../../../server/services/stripe");

const CUSTOMER_ID = "cus_live123";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cancelSubscriptionsForCustomer (live wiring)", () => {
  it("maps the sweep onto stripe.subscriptions.list and .cancel", async () => {
    listMock.mockResolvedValue({
      data: [{ id: "sub_live", status: "active" }],
      has_more: false,
    });
    cancelMock.mockResolvedValue({ id: "sub_live", status: "canceled" });

    const result = await cancelSubscriptionsForCustomer(CUSTOMER_ID);

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ customer: CUSTOMER_ID, status: "all" }),
    );
    expect(cancelMock).toHaveBeenCalledWith("sub_live");
    expect(result.canceledCount).toBe(1);
  });

  it("sanitizes a Stripe failure so no statusCode-bearing error escapes", async () => {
    const leaky = Object.assign(new Error("No such customer: 'cus_live123'"), {
      statusCode: 404,
    });
    listMock.mockRejectedValue(leaky);

    const error = await cancelSubscriptionsForCustomer(CUSTOMER_ID).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Stripe subscription sweep failed");
    expect((error as { statusCode?: number }).statusCode).toBeUndefined();
  });
});
