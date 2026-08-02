import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SetBillingPlanCard from "../../app/components/settings/SetBillingPlanCard.vue";
import type { BillingUsage } from "../../app/composables/useBillingUsage";

const globalConfig = {
  global: {
    stubs: {
      AppAlert: {
        template: '<div class="app-alert" :data-tone="tone"><slot /></div>',
        props: ["tone", "title"],
      },
      AppBtn: {
        template:
          '<a v-if="href" :href="href"><slot /></a><button v-else :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        props: ["variant", "size", "icon", "disabled", "href"],
        emits: ["click"],
      },
      AppBadge: {
        template: '<span class="app-badge" :data-tone="tone"><slot /></span>',
        props: ["tone", "dot"],
      },
      AppIcon: true,
    },
  },
};

const TRIALING_USAGE: BillingUsage = {
  recordsCreatedThisMonth: 284,
  connectedSourceCount: 2,
  plan: "pro",
  status: "trialing",
  trialEndsAt: "2026-06-23T00:00:00Z",
  trialDaysLeft: 9,
  trialPercentElapsed: 64,
};

const ACTIVE_USAGE: BillingUsage = {
  recordsCreatedThisMonth: 5000,
  connectedSourceCount: 4,
  plan: "pro",
  status: "active",
  trialEndsAt: null,
  trialDaysLeft: null,
  trialPercentElapsed: null,
};

const HOBBY_USAGE: BillingUsage = {
  recordsCreatedThisMonth: 12,
  connectedSourceCount: 1,
  plan: "hobby",
  status: "active",
  trialEndsAt: null,
  trialDaysLeft: null,
  trialPercentElapsed: null,
};

function mountCard(
  usage: BillingUsage,
  overrides: { isRedirecting?: boolean; redirectError?: string | null } = {},
) {
  return mount(SetBillingPlanCard, {
    ...globalConfig,
    props: {
      usage,
      isRedirecting: overrides.isRedirecting ?? false,
      redirectError: overrides.redirectError ?? null,
    },
  });
}

describe("SetBillingPlanCard", () => {
  it("matches snapshot while trialing", () => {
    const wrapper = mountCard(TRIALING_USAGE);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot for an active Hobby plan", () => {
    const wrapper = mountCard(HOBBY_USAGE);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the plan badge label and tone", () => {
    const wrapper = mountCard(TRIALING_USAGE);
    const badge = wrapper.find(".app-badge");
    expect(badge.text()).toBe("pro trial");
    expect(badge.attributes("data-tone")).toBe("accent");
  });

  it("shows the trial end date and days left while trialing", () => {
    const wrapper = mountCard(TRIALING_USAGE);
    expect(wrapper.text()).toContain("trial ends Jun 23, 2026 · 9 days left");
  });

  it("hides the trial line for an active plan", () => {
    const wrapper = mountCard(ACTIVE_USAGE);
    expect(wrapper.text()).not.toContain("trial ends");
  });

  it("labels the CTA 'add payment method' while trialing", () => {
    const wrapper = mountCard(TRIALING_USAGE);
    expect(wrapper.find("button").text()).toBe("add payment method");
  });

  it("labels the CTA 'manage billing' for an active Pro plan", () => {
    const wrapper = mountCard(ACTIVE_USAGE);
    expect(wrapper.find("button").text()).toBe("manage billing");
  });

  it("labels the CTA 'upgrade to pro' on the Hobby plan", () => {
    const wrapper = mountCard(HOBBY_USAGE);
    expect(wrapper.find("button").text()).toBe("upgrade to pro");
  });

  it("emits add-payment-method when the CTA button is clicked", async () => {
    const wrapper = mountCard(TRIALING_USAGE);
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("add-payment-method")).toHaveLength(1);
  });

  it("disables the CTA and shows 'redirecting…' while isRedirecting", () => {
    const wrapper = mountCard(TRIALING_USAGE, { isRedirecting: true });
    const button = wrapper.find("button");
    expect(button.text()).toBe("redirecting…");
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the redirect error when set", () => {
    const wrapper = mountCard(TRIALING_USAGE, {
      redirectError: "Failed to start a billing session.",
    });
    const alert = wrapper.find('.app-alert[data-tone="err"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("Failed to start a billing session.");
  });

  it("hides the redirect error alert by default", () => {
    const wrapper = mountCard(TRIALING_USAGE);
    expect(wrapper.find(".app-alert").exists()).toBe(false);
  });

  it("always links compare plans to /pricing", () => {
    const wrapper = mountCard(TRIALING_USAGE);
    const link = wrapper.find("a");
    expect(link.attributes("href")).toBe("/pricing");
    expect(link.text()).toContain("compare plans");
  });
});
