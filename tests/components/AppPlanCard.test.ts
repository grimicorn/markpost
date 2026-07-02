import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppBadge from "../../app/components/AppBadge.vue";
import AppPlanCard from "../../app/components/AppPlanCard.vue";
import type { PlanBadge } from "../../app/composables/useBillingUsage";

const globalConfig = {
  global: {
    components: { AppBadge },
    stubs: {
      NuxtLink: {
        template: '<a :href="to"><slot /></a>',
        props: ["to"],
      },
    },
  },
};

const trialBadge: PlanBadge = { label: "pro trial", tone: "accent" };

describe("AppPlanCard", () => {
  it("matches snapshot while trialing", () => {
    const wrapper = mount(AppPlanCard, {
      ...globalConfig,
      props: { badge: trialBadge, trialDaysLeft: 9, trialPercentElapsed: 64 },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot for an active plan with no trial", () => {
    const wrapper = mount(AppPlanCard, {
      ...globalConfig,
      props: {
        badge: { label: "pro", tone: "ok" },
        trialDaysLeft: null,
        trialPercentElapsed: null,
      },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the badge label and tone", () => {
    const wrapper = mount(AppPlanCard, {
      ...globalConfig,
      props: { badge: trialBadge, trialDaysLeft: 9, trialPercentElapsed: 64 },
    });
    const badge = wrapper.find(".badge");
    expect(badge.text()).toBe("pro trial");
    expect(badge.classes()).toContain("accent");
  });

  it("shows days left when trialDaysLeft is set", () => {
    const wrapper = mount(AppPlanCard, {
      ...globalConfig,
      props: { badge: trialBadge, trialDaysLeft: 9, trialPercentElapsed: 64 },
    });
    expect(wrapper.text()).toContain("9d left");
  });

  it("hides days left when trialDaysLeft is null", () => {
    const wrapper = mount(AppPlanCard, {
      ...globalConfig,
      props: {
        badge: { label: "pro", tone: "ok" },
        trialDaysLeft: null,
        trialPercentElapsed: null,
      },
    });
    expect(wrapper.text()).not.toContain("d left");
  });

  it("renders the progress bar with the given width when trialPercentElapsed is set", () => {
    const wrapper = mount(AppPlanCard, {
      ...globalConfig,
      props: { badge: trialBadge, trialDaysLeft: 9, trialPercentElapsed: 64 },
    });
    const bar = wrapper.find('div[style*="var(--accent)"]');
    expect(bar.attributes("style")).toContain("width: 64%");
  });

  it("hides the progress bar when trialPercentElapsed is null", () => {
    const wrapper = mount(AppPlanCard, {
      ...globalConfig,
      props: {
        badge: { label: "pro", tone: "ok" },
        trialDaysLeft: null,
        trialPercentElapsed: null,
      },
    });
    expect(wrapper.find('div[style*="var(--accent)"]').exists()).toBe(false);
  });

  it("always renders the upgrade plan link", () => {
    const wrapper = mount(AppPlanCard, {
      ...globalConfig,
      props: {
        badge: { label: "pro", tone: "ok" },
        trialDaysLeft: null,
        trialPercentElapsed: null,
      },
    });
    const link = wrapper.find("a");
    expect(link.attributes("href")).toBe("/pricing");
    expect(link.text()).toContain("upgrade plan");
  });
});
