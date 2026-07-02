export type BillingPlan = "hobby" | "pro";

export type BillingStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

export type BillingUsage = {
  recordsSyncedThisMonth: number;
  connectedSourceCount: number;
  plan: BillingPlan;
  status: BillingStatus;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  trialPercentElapsed: number | null;
};

type BillingUsageApiResponse = {
  data: BillingUsage;
};

export async function fetchBillingUsage(): Promise<BillingUsage | null> {
  try {
    const response =
      await $fetch<BillingUsageApiResponse>("/api/billing/usage");
    return response.data;
  } catch (fetchError) {
    console.error("[useBillingUsage] fetchBillingUsage error:", fetchError);
    return null;
  }
}

export type PlanBadgeTone = "" | "ok" | "warn" | "err" | "info" | "accent";

export type PlanBadge = {
  label: string;
  tone: PlanBadgeTone;
};

export function derivePlanBadge(
  plan: BillingPlan,
  status: BillingStatus,
): PlanBadge {
  if (status === "trialing") {
    return { label: `${plan} trial`, tone: "accent" };
  }

  if (status === "active") {
    return { label: plan, tone: "ok" };
  }

  if (status === "past_due") {
    return { label: "past due", tone: "warn" };
  }

  return { label: status, tone: "err" };
}
