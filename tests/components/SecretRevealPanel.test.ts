import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SecretRevealPanel from "../../app/components/SecretRevealPanel.vue";
import AppIcon from "../../app/components/AppIcon.vue";
import AppCopyBtn from "../../app/components/AppCopyBtn.vue";

const globalConfig = {
  global: {
    components: { AppIcon, AppCopyBtn },
  },
};

describe("SecretRevealPanel", () => {
  it("renders the label, secret, and default copy button", () => {
    const wrapper = mount(SecretRevealPanel, {
      ...globalConfig,
      props: { label: "webhook secret", secret: "abc123secret" },
    });
    expect(wrapper.text()).toContain("webhook secret");
    expect(wrapper.text()).toContain("abc123secret");
    expect(wrapper.text()).toContain("copy secret");
  });

  it("passes the secret to the copy button", () => {
    const wrapper = mount(SecretRevealPanel, {
      ...globalConfig,
      props: { label: "secret", secret: "abc123secret" },
    });
    expect(wrapper.findComponent(AppCopyBtn).props("text")).toBe(
      "abc123secret",
    );
  });

  it("renders the hint when provided", () => {
    const wrapper = mount(SecretRevealPanel, {
      ...globalConfig,
      props: {
        label: "secret",
        secret: "abc123secret",
        hint: "Paste this into GitHub.",
      },
    });
    expect(wrapper.text()).toContain("Paste this into GitHub.");
  });

  it("omits the hint element when no hint is given", () => {
    const wrapper = mount(SecretRevealPanel, {
      ...globalConfig,
      props: { label: "secret", secret: "abc123secret" },
    });
    expect(wrapper.find(".muted").exists()).toBe(false);
  });

  it("uses a custom copy label when supplied", () => {
    const wrapper = mount(SecretRevealPanel, {
      ...globalConfig,
      props: {
        label: "secret",
        secret: "abc123secret",
        copyLabel: "copy token",
      },
    });
    expect(wrapper.text()).toContain("copy token");
  });
});
