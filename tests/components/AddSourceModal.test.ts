import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AddSourceModal from "../../app/components/AddSourceModal.vue";
import AppIcon from "../../app/components/AppIcon.vue";
import AppAlert from "../../app/components/AppAlert.vue";
import AppField from "../../app/components/AppField.vue";
import AppChip from "../../app/components/AppChip.vue";
import AppBtn from "../../app/components/AppBtn.vue";

const globalConfig = {
  global: {
    components: { AppIcon, AppAlert, AppField, AppChip, AppBtn },
  },
};

function pickStep() {
  return {
    modalState: { step: "pick" as const, choice: null, folder: "99-incoming/" },
  };
}

describe("AddSourceModal", () => {
  it("matches snapshot for the pick step", () => {
    const wrapper = mount(AddSourceModal, {
      ...globalConfig,
      props: pickStep(),
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot for the config step (github preset)", () => {
    const wrapper = mount(AddSourceModal, {
      ...globalConfig,
      props: {
        modalState: {
          step: "config" as const,
          choice: {
            id: "github",
            name: "GitHub",
            desc: "Pushes, issues, PRs & releases.",
            map: "repo · ref · title · body",
            via: "webhook",
            authKind: "signature" as const,
          },
          folder: "99-incoming/",
        },
      },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("marks the RSS / Atom preset as disabled and shows a 'coming soon' chip", () => {
    const wrapper = mount(AddSourceModal, {
      ...globalConfig,
      props: pickStep(),
    });
    const rssButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("RSS / Atom"));

    expect(rssButton).toBeDefined();
    expect(rssButton?.attributes("disabled")).toBeDefined();
    expect(rssButton?.text()).toContain("coming soon");
    expect(rssButton?.text()).not.toContain("via poll");
  });

  it("does not emit pick when the disabled RSS preset is clicked", async () => {
    const wrapper = mount(AddSourceModal, {
      ...globalConfig,
      props: pickStep(),
    });
    const rssButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("RSS / Atom"));

    await rssButton?.trigger("click");

    expect(wrapper.emitted("pick")).toBeUndefined();
  });

  it("emits pick with the preset when an enabled preset (GitHub) is clicked", async () => {
    const wrapper = mount(AddSourceModal, {
      ...globalConfig,
      props: pickStep(),
    });
    const githubButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("GitHub"));

    await githubButton?.trigger("click");

    expect(wrapper.emitted("pick")?.[0]?.[0]).toMatchObject({ id: "github" });
  });

  it("describes GitHub as verified by signature, not a generic shared secret", () => {
    const wrapper = mount(AddSourceModal, {
      ...globalConfig,
      props: {
        modalState: {
          step: "config" as const,
          choice: {
            id: "github",
            name: "GitHub",
            via: "webhook",
            authKind: "signature" as const,
          },
          folder: "99-incoming/",
        },
      },
    });
    expect(wrapper.text()).toContain("signature verification");
    expect(wrapper.text()).not.toContain("shared secret");
  });

  it("describes Zapier as verified by a shared secret, not 'signature verification'", () => {
    const wrapper = mount(AddSourceModal, {
      ...globalConfig,
      props: {
        modalState: {
          step: "config" as const,
          choice: {
            id: "zapier",
            name: "Zapier",
            via: "webhook",
            authKind: "sharedSecret" as const,
          },
          folder: "99-incoming/",
        },
      },
    });
    expect(wrapper.text()).toContain("shared secret");
    expect(wrapper.text()).not.toContain("signature verification");
  });
});
