import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

import {
  fetchBillingUsage,
  derivePlanBadge,
  describeBillingState,
  deriveBillingCtaLabel,
  describeRecordsCreatedHint,
  describeConnectedSourcesHint,
  describeTrialStatus,
} from "../../app/composables/useBillingUsage";

describe("fetchBillingUsage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns usage data on success", async () => {
    const usageData = {
      recordsCreatedThisMonth: 284,
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

describe("describeBillingState", () => {
  it("describes the free Hobby plan regardless of status", () => {
    expect(describeBillingState("hobby", "active")).toBe(
      "You're on the free Hobby plan. Upgrade to Pro for unlimited sources and records.",
    );
  });

  it("describes a Pro trial", () => {
    expect(describeBillingState("pro", "trialing")).toContain("Pro trial");
  });

  it("describes an active Pro plan", () => {
    expect(describeBillingState("pro", "active")).toBe(
      "You're on the Pro plan.",
    );
  });

  it("describes a past_due Pro subscription", () => {
    expect(describeBillingState("pro", "past_due")).toContain(
      "last payment failed",
    );
  });

  it("describes a canceled Pro subscription", () => {
    expect(describeBillingState("pro", "canceled")).toContain("canceled");
  });

  it("describes an incomplete Pro subscription", () => {
    expect(describeBillingState("pro", "incomplete")).toContain("incomplete");
  });
});

describe("deriveBillingCtaLabel", () => {
  it("labels the CTA 'upgrade to pro' on the Hobby plan", () => {
    expect(deriveBillingCtaLabel("hobby", "active")).toBe("upgrade to pro");
  });

  it("labels the CTA 'add payment method' while trialing", () => {
    expect(deriveBillingCtaLabel("pro", "trialing")).toBe("add payment method");
  });

  it("labels the CTA 'manage billing' for an active Pro plan", () => {
    expect(deriveBillingCtaLabel("pro", "active")).toBe("manage billing");
  });

  it("labels the CTA 'update payment method' when past due", () => {
    expect(deriveBillingCtaLabel("pro", "past_due")).toBe(
      "update payment method",
    );
  });

  it("labels the CTA 'resubscribe' when canceled", () => {
    expect(deriveBillingCtaLabel("pro", "canceled")).toBe("resubscribe");
  });

  it("labels the CTA 'add payment method' when incomplete", () => {
    expect(deriveBillingCtaLabel("pro", "incomplete")).toBe(
      "add payment method",
    );
  });
});

describe("describeRecordsCreatedHint", () => {
  it("shows unlimited on the Pro plan", () => {
    expect(describeRecordsCreatedHint("pro", 284)).toBe(
      "284 of unlimited on Pro.",
    );
  });

  it("shows the monthly cap on the Hobby plan", () => {
    expect(describeRecordsCreatedHint("hobby", 42)).toBe("42 of 100 on Hobby.");
  });
});

describe("describeConnectedSourcesHint", () => {
  it("shows unlimited on the Pro plan", () => {
    expect(describeConnectedSourcesHint("pro", 2)).toBe("2 of unlimited.");
  });

  it("shows the source cap on the Hobby plan", () => {
    expect(describeConnectedSourcesHint("hobby", 1)).toBe("1 of 1 on Hobby.");
  });
});

describe("describeTrialStatus", () => {
  it("returns null when the subscription is not trialing", () => {
    expect(describeTrialStatus("active", "2026-06-23T00:00:00Z", 9)).toBeNull();
  });

  it("returns null when trialEndsAt is missing", () => {
    expect(describeTrialStatus("trialing", null, 9)).toBeNull();
  });

  it("returns null when trialDaysLeft is missing", () => {
    expect(
      describeTrialStatus("trialing", "2026-06-23T00:00:00Z", null),
    ).toBeNull();
  });

  it("formats the trial end date and pluralizes days left", () => {
    expect(describeTrialStatus("trialing", "2026-06-23T00:00:00Z", 9)).toBe(
      "trial ends Jun 23, 2026 · 9 days left",
    );
  });

  it("uses the singular 'day' when exactly one day is left", () => {
    expect(describeTrialStatus("trialing", "2026-06-23T00:00:00Z", 1)).toBe(
      "trial ends Jun 23, 2026 · 1 day left",
    );
  });
});
