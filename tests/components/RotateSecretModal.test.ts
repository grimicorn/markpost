import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RotateSecretModal from "../../app/components/RotateSecretModal.vue";
import AppIcon from "../../app/components/AppIcon.vue";
import AppAlert from "../../app/components/AppAlert.vue";
import AppField from "../../app/components/AppField.vue";
import AppBtn from "../../app/components/AppBtn.vue";
import AppCopyBtn from "../../app/components/AppCopyBtn.vue";
import SecretRevealPanel from "../../app/components/SecretRevealPanel.vue";
import ManualSecretField from "../../app/components/ManualSecretField.vue";

const globalConfig = {
  global: {
    components: {
      AppIcon,
      AppAlert,
      AppField,
      AppBtn,
      AppCopyBtn,
      SecretRevealPanel,
      ManualSecretField,
    },
  },
};

function confirmState(provider: string, name: string) {
  return {
    rotateState: {
      step: "confirm" as const,
      source: { uuid: "uuid-1", provider, name },
    },
  };
}

function revealState(provider: string, name: string, revealSecret: string) {
  return {
    rotateState: {
      step: "reveal" as const,
      source: { uuid: "uuid-1", provider, name },
      revealSecret,
    },
  };
}

function findButton(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper
    .findAll("button")
    .find((button) => button.text().includes(label));
}

describe("RotateSecretModal", () => {
  it("matches snapshot for the confirm step (github)", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: confirmState("github", "GitHub"),
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot for the reveal step (github)", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: revealState("github", "GitHub", "fresh-generated-secret"),
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("warns that rotation replaces the current secret in the confirm step", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: confirmState("github", "GitHub"),
    });
    expect(wrapper.text()).toContain("replaces the current secret");
  });

  it("does not show a manual secret input for a generated-secret provider", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: confirmState("github", "GitHub"),
    });
    expect(wrapper.find("input").exists()).toBe(false);
  });

  it("emits rotate with no secret when confirming a generated-secret provider", async () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: confirmState("github", "GitHub"),
    });
    await findButton(wrapper, "rotate secret")?.trigger("click");
    expect(wrapper.emitted("rotate")?.[0]).toEqual([undefined]);
  });

  it("shows a Stripe-specific secret input for the manual-secret provider", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: confirmState("stripe", "Stripe"),
    });
    expect(wrapper.find("input").exists()).toBe(true);
    expect(wrapper.text()).toContain("Stripe webhook signing secret");
  });

  it("disables rotate until a manual secret is entered, then emits it trimmed", async () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: confirmState("stripe", "Stripe"),
    });
    const rotateButton = findButton(wrapper, "rotate secret");
    expect(rotateButton?.attributes("disabled")).toBeDefined();

    await wrapper.find("input").setValue("  whsec_new  ");
    expect(rotateButton?.attributes("disabled")).toBeUndefined();

    await rotateButton?.trigger("click");
    expect(wrapper.emitted("rotate")?.[0]).toEqual(["whsec_new"]);
  });

  it("reveals the new secret once with a copy button in the reveal step", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: revealState("github", "GitHub", "fresh-generated-secret"),
    });
    expect(wrapper.text()).toContain("fresh-generated-secret");
    expect(wrapper.text()).toContain("copy secret");
    expect(wrapper.text()).toContain("webhook secret");
  });

  it("does not render the header close (X) button during the reveal step", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: revealState("github", "GitHub", "fresh-generated-secret"),
    });
    const buttonLabels = wrapper
      .findAll("button")
      .map((button) => button.text().trim());
    expect(buttonLabels).toEqual(["copy secret", "done"]);
  });

  it("does not emit close when the backdrop is clicked during the reveal step", async () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: revealState("github", "GitHub", "fresh-generated-secret"),
    });
    await wrapper.find("div").trigger("click");
    expect(wrapper.emitted("close")).toBeUndefined();
  });

  it("emits close from the backdrop during the confirm step", async () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: confirmState("github", "GitHub"),
    });
    await wrapper.find("div").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("confirms the update without a reveal in the done step (manual provider)", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: {
        rotateState: {
          step: "done" as const,
          source: { uuid: "uuid-1", provider: "stripe", name: "Stripe" },
        },
      },
    });
    expect(wrapper.text()).toContain("Secret updated");
    expect(wrapper.text()).not.toContain("copy secret");
  });

  it("disables rotate and emits nothing while submitting", async () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: { ...confirmState("github", "GitHub"), submitting: true },
    });
    const rotateButton = findButton(wrapper, "rotate secret");
    expect(rotateButton?.attributes("disabled")).toBeDefined();

    await rotateButton?.trigger("click");
    expect(wrapper.emitted("rotate")).toBeUndefined();
  });

  it("hides the header close button while submitting so an in-flight rotation can't be dismissed", () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: { ...confirmState("github", "GitHub"), submitting: true },
    });
    const buttonLabels = wrapper
      .findAll("button")
      .map((button) => button.text().trim());
    expect(buttonLabels).not.toContain("");
    expect(buttonLabels).toEqual(["cancel", "rotate secret"]);
  });

  it("does not emit close from the backdrop while submitting", async () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: { ...confirmState("github", "GitHub"), submitting: true },
    });
    await wrapper.find("div").trigger("click");
    expect(wrapper.emitted("close")).toBeUndefined();
  });

  it("emits close when done is clicked", async () => {
    const wrapper = mount(RotateSecretModal, {
      ...globalConfig,
      props: revealState("github", "GitHub", "fresh-generated-secret"),
    });
    await findButton(wrapper, "done")?.trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
