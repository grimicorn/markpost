import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SetBillingUsageCard from "../../app/components/settings/SetBillingUsageCard.vue";
import type { BillingUsage } from "../../app/composables/useBillingUsage";

const globalConfig = {
  global: {
    stubs: {
      SetRow: {
        template:
          '<div class="set-row" :data-label="label" :data-hint="hint"><slot /></div>',
        props: ["label", "hint"],
      },
    },
  },
};

const PRO_USAGE: BillingUsage = {
  recordsCreatedThisMonth: 284,
  connectedSourceCount: 2,
  plan: "pro",
  status: "active",
  trialEndsAt: null,
  trialDaysLeft: null,
  trialPercentElapsed: null,
};

const HOBBY_USAGE: BillingUsage = {
  recordsCreatedThisMonth: 42,
  connectedSourceCount: 1,
  plan: "hobby",
  status: "active",
  trialEndsAt: null,
  trialDaysLeft: null,
  trialPercentElapsed: null,
};

describe("SetBillingUsageCard", () => {
  it("matches snapshot with Pro usage loaded", () => {
    const wrapper = mount(SetBillingUsageCard, {
      ...globalConfig,
      props: { usage: PRO_USAGE },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot while usage is null (loading/error)", () => {
    const wrapper = mount(SetBillingUsageCard, {
      ...globalConfig,
      props: { usage: null },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the real records created count", () => {
    const wrapper = mount(SetBillingUsageCard, {
      ...globalConfig,
      props: { usage: PRO_USAGE },
    });
    expect(wrapper.text()).toContain("284");
  });

  it("renders the real connected source count", () => {
    const wrapper = mount(SetBillingUsageCard, {
      ...globalConfig,
      props: { usage: PRO_USAGE },
    });
    expect(wrapper.text()).toContain("2");
  });

  it("shows unlimited hints on the Pro plan", () => {
    const wrapper = mount(SetBillingUsageCard, {
      ...globalConfig,
      props: { usage: PRO_USAGE },
    });
    expect(
      wrapper.find('[data-label="Records created"]').attributes()["data-hint"],
    ).toBe("284 of unlimited on Pro.");
    expect(
      wrapper.find('[data-label="Connected sources"]').attributes()[
        "data-hint"
      ],
    ).toBe("2 of unlimited.");
  });

  it("shows capped hints on the Hobby plan", () => {
    const wrapper = mount(SetBillingUsageCard, {
      ...globalConfig,
      props: { usage: HOBBY_USAGE },
    });
    expect(
      wrapper.find('[data-label="Records created"]').attributes()["data-hint"],
    ).toBe("42 of 100 on Hobby.");
    expect(
      wrapper.find('[data-label="Connected sources"]').attributes()[
        "data-hint"
      ],
    ).toBe("1 of 1 on Hobby.");
  });

  it("shows a placeholder for counts and no hint while usage is null", () => {
    const wrapper = mount(SetBillingUsageCard, {
      ...globalConfig,
      props: { usage: null },
    });
    expect(wrapper.text()).toContain("…");
    expect(
      wrapper.find('[data-label="Records created"]').attributes()["data-hint"],
    ).toBeUndefined();
  });
});
