import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

import {
  fetchBillingUsage,
  derivePlanBadge,
} from "../../app/composables/useBillingUsage";

describe("fetchBillingUsage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns usage data on success", async () => {
    const usageData = {
      recordsSyncedThisMonth: 284,
      connectedSourceCount: 2,
      plan: "pro" as const,
      status: "trialing" as const,
      trialEndsAt: "2026-07-10T00:00:00Z",
      trialDaysLeft: 9,
      trialPercentElapsed: 64,
    };
    mockFetch.mockResolvedValue({ data: usageData });

    const result = await fetchBillingUsage();

    expect(result).toEqual(usageData);
    expect(mockFetch).toHaveBeenCalledWith("/api/billing/usage");
  });

  it("returns null on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const result = await fetchBillingUsage();

    expect(result).toBeNull();
  });
});

describe("derivePlanBadge", () => {
  it("labels a trialing plan with a ' trial' suffix and accent tone", () => {
    expect(derivePlanBadge("pro", "trialing")).toEqual({
      label: "pro trial",
      tone: "accent",
    });
  });

  it("labels an active pro plan with the plan name and ok tone", () => {
    expect(derivePlanBadge("pro", "active")).toEqual({
      label: "pro",
      tone: "ok",
    });
  });

  it("labels an active hobby plan with the plan name and ok tone", () => {
    expect(derivePlanBadge("hobby", "active")).toEqual({
      label: "hobby",
      tone: "ok",
    });
  });

  it("labels a past_due subscription with a warn tone", () => {
    expect(derivePlanBadge("pro", "past_due")).toEqual({
      label: "past due",
      tone: "warn",
    });
  });

  it("labels a canceled subscription with an err tone", () => {
    expect(derivePlanBadge("pro", "canceled")).toEqual({
      label: "canceled",
      tone: "err",
    });
  });

  it("labels an incomplete subscription with an err tone", () => {
    expect(derivePlanBadge("hobby", "incomplete")).toEqual({
      label: "incomplete",
      tone: "err",
    });
  });
});
