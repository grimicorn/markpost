import {
  HOBBY_MONTHLY_RECORD_LIMIT,
  HOBBY_CONNECTED_SOURCE_LIMIT,
} from "#shared/utils/planLimits";

export type BillingPlan = "hobby" | "pro";

export type BillingStatus =
  "active" | "trialing" | "past_due" | "canceled" | "incomplete";

export type BillingUsage = {
  recordsCreatedThisMonth: number;
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

function describeProBillingState(status: BillingStatus): string {
  if (status === "trialing") {
    return "You're on the Pro trial. Add a payment method any time before it ends to keep Pro features.";
  }

  if (status === "past_due") {
    return "Your last payment failed. Update your payment method to avoid losing Pro features.";
  }

  if (status === "canceled") {
    return "Your Pro subscription has been canceled. Resubscribe to restore Pro features.";
  }

  if (status === "incomplete") {
    return "Your Pro subscription setup is incomplete. Add a payment method to activate it.";
  }

  return "You're on the Pro plan.";
}

export function describeBillingState(
  plan: BillingPlan,
  status: BillingStatus,
): string {
  if (plan === "hobby") {
    return "You're on the free Hobby plan. Upgrade to Pro for unlimited sources and records.";
  }

  return describeProBillingState(status);
}

function deriveProBillingCtaLabel(status: BillingStatus): string {
  if (status === "past_due") {
    return "update payment method";
  }

  if (status === "active") {
    return "manage billing";
  }

  if (status === "canceled") {
    return "resubscribe";
  }

  return "add payment method";
}

export function deriveBillingCtaLabel(
  plan: BillingPlan,
  status: BillingStatus,
): string {
  if (plan === "hobby") {
    return "upgrade to pro";
  }

  return deriveProBillingCtaLabel(status);
}

// HOBBY_MONTHLY_RECORD_LIMIT / HOBBY_CONNECTED_SOURCE_LIMIT mirror the Hobby
// plan copy on the /pricing page (app/pages/pricing.vue: hobbyFeatures /
// comparisonRows) and are enforced server-side (server/utils/planLimits.ts).
// Pro has no cap. Both live in shared/utils/planLimits.ts so there is exactly
// one copy of the numbers.

export function describeRecordsCreatedHint(
  plan: BillingPlan,
  recordsCreatedThisMonth: number,
): string {
  if (plan === "pro") {
    return `${recordsCreatedThisMonth} of unlimited on Pro.`;
  }

  return `${recordsCreatedThisMonth} of ${HOBBY_MONTHLY_RECORD_LIMIT} on Hobby.`;
}

export function describeConnectedSourcesHint(
  plan: BillingPlan,
  connectedSourceCount: number,
): string {
  if (plan === "pro") {
    return `${connectedSourceCount} of unlimited.`;
  }

  return `${connectedSourceCount} of ${HOBBY_CONNECTED_SOURCE_LIMIT} on Hobby.`;
}

const TRIAL_END_DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
};

function formatTrialEndDate(trialEndsAtIso: string): string {
  return new Date(trialEndsAtIso).toLocaleDateString(
    "en-US",
    TRIAL_END_DATE_FORMAT_OPTIONS,
  );
}

// e.g. "trial ends Jun 23, 2026 · 9 days left". Returns null whenever there
// isn't a trial to describe (not trialing, or the subscription is missing
// trial data).
export function describeTrialStatus(
  status: BillingStatus,
  trialEndsAt: string | null,
  trialDaysLeft: number | null,
): string | null {
  const hasTrialData =
    status === "trialing" && trialEndsAt !== null && trialDaysLeft !== null;

  if (!hasTrialData) {
    return null;
  }

  const formattedDate = formatTrialEndDate(trialEndsAt);
  const dayWord = trialDaysLeft === 1 ? "day" : "days";
  return `trial ends ${formattedDate} · ${trialDaysLeft} ${dayWord} left`;
}
