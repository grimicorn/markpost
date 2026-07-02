import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import type { BillingUsage } from "../../app/composables/useBillingUsage";

const mockLoad = vi.fn();
const mockAddPaymentMethod = vi.fn();

const billingState = {
  usage: ref<BillingUsage | null>(null),
  isLoading: ref(false),
  loadError: ref<string | null>(null),
  isRedirecting: ref(false),
  redirectError: ref<string | null>(null),
  load: mockLoad,
  addPaymentMethod: mockAddPaymentMethod,
};

vi.mock("../../app/composables/useBillingSettings", () => ({
  useBillingSettings: () => billingState,
}));

// Import AFTER the mock
import SetBilling from "../../app/components/settings/SetBilling.vue";

const TRIALING_USAGE: BillingUsage = {
  recordsSyncedThisMonth: 284,
  connectedSourceCount: 2,
  plan: "pro",
  status: "trialing",
  trialEndsAt: "2026-06-23T00:00:00Z",
  trialDaysLeft: 9,
  trialPercentElapsed: 64,
};

const globalConfig = {
  global: {
    stubs: {
      SetHead: {
        template: '<div class="set-head" :data-desc="desc" />',
        props: ["eyebrow", "title", "desc"],
      },
      SetLoadErrorAlert: {
        template:
          '<div class="load-error-alert" :data-message="message" :data-retrying="retrying" @click="$emit(\'retry\')" />',
        props: ["message", "retrying"],
        emits: ["retry"],
      },
      SetBillingPlanCard: {
        template:
          '<div class="plan-card" @click="$emit(\'add-payment-method\')" />',
        props: ["usage", "isRedirecting", "redirectError"],
        emits: ["add-payment-method"],
      },
      SetBillingUsageCard: {
        template: '<div class="usage-card" />',
        props: ["usage"],
      },
    },
  },
};

function mountComponent() {
  return mount(SetBilling, globalConfig);
}

describe("SetBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingState.usage.value = null;
    billingState.isLoading.value = false;
    billingState.loadError.value = null;
    billingState.isRedirecting.value = false;
    billingState.redirectError.value = null;
  });

  it("calls load on mount", () => {
    mountComponent();
    expect(mockLoad).toHaveBeenCalled();
  });

  it("matches snapshot while loading", () => {
    billingState.isLoading.value = true;
    const wrapper = mountComponent();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot once usage has loaded", () => {
    billingState.usage.value = TRIALING_USAGE;
    const wrapper = mountComponent();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot on load error", () => {
    billingState.loadError.value = "Failed to load billing details.";
    const wrapper = mountComponent();
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows a loading description while usage has not loaded", () => {
    billingState.isLoading.value = true;
    const wrapper = mountComponent();
    expect(wrapper.find(".set-head").attributes("data-desc")).toBe(
      "Loading your billing details…",
    );
  });

  it("shows an error description when loading fails", () => {
    billingState.loadError.value = "Failed to load billing details.";
    const wrapper = mountComponent();
    expect(wrapper.find(".set-head").attributes("data-desc")).toBe(
      "Unable to load your billing details. Try again below.",
    );
  });

  it("describes the loaded plan once usage arrives", () => {
    billingState.usage.value = TRIALING_USAGE;
    const wrapper = mountComponent();
    expect(wrapper.find(".set-head").attributes("data-desc")).toContain(
      "Pro trial",
    );
  });

  it("renders the load error alert when loadError is set", () => {
    billingState.loadError.value = "Failed to load billing details.";
    const wrapper = mountComponent();
    const alert = wrapper.find(".load-error-alert");
    expect(alert.exists()).toBe(true);
    expect(alert.attributes("data-message")).toBe(
      "Failed to load billing details.",
    );
  });

  it("hides the load error alert when there is no error", () => {
    const wrapper = mountComponent();
    expect(wrapper.find(".load-error-alert").exists()).toBe(false);
  });

  it("calls load again when the error alert emits retry", async () => {
    billingState.loadError.value = "Failed to load billing details.";
    const wrapper = mountComponent();
    mockLoad.mockClear();
    await wrapper.find(".load-error-alert").trigger("click");
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it("shows a placeholder card instead of the plan card while usage is null", () => {
    const wrapper = mountComponent();
    expect(wrapper.find(".plan-card").exists()).toBe(false);
    expect(wrapper.text()).toContain("Billing details unavailable.");
  });

  it("renders the plan card once usage has loaded", () => {
    billingState.usage.value = TRIALING_USAGE;
    const wrapper = mountComponent();
    expect(wrapper.find(".plan-card").exists()).toBe(true);
  });

  it("calls addPaymentMethod when the plan card emits add-payment-method", async () => {
    billingState.usage.value = TRIALING_USAGE;
    const wrapper = mountComponent();
    await wrapper.find(".plan-card").trigger("click");
    expect(mockAddPaymentMethod).toHaveBeenCalledTimes(1);
  });

  it("always renders the usage card", () => {
    const wrapper = mountComponent();
    expect(wrapper.find(".usage-card").exists()).toBe(true);
  });
});
