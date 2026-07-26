import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AddSourceModal from "../../app/components/AddSourceModal.vue";
import AppIcon from "../../app/components/AppIcon.vue";
import AppAlert from "../../app/components/AppAlert.vue";
import AppField from "../../app/components/AppField.vue";
import AppChip from "../../app/components/AppChip.vue";
import AppBtn from "../../app/components/AppBtn.vue";
import AppCopyBtn from "../../app/components/AppCopyBtn.vue";

const globalConfig = {
  global: {
    components: { AppIcon, AppAlert, AppField, AppChip, AppBtn, AppCopyBtn },
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

  describe("reveal step", () => {
    function revealStepProps(choiceId: string, choiceName: string) {
      return {
        modalState: {
          step: "reveal" as const,
          choice: { id: choiceId, name: choiceName },
          folder: "99-incoming/",
          revealSecret: "generated-secret-value",
        },
      };
    }

    it("matches snapshot for the reveal step (github preset)", () => {
      const wrapper = mount(AddSourceModal, {
        ...globalConfig,
        props: revealStepProps("github", "GitHub"),
      });
      expect(wrapper.html()).toMatchSnapshot();
    });

    it("shows the generated secret and a copy button", () => {
      const wrapper = mount(AddSourceModal, {
        ...globalConfig,
        props: revealStepProps("github", "GitHub"),
      });
      expect(wrapper.text()).toContain("generated-secret-value");
      expect(wrapper.text()).toContain("copy secret");
    });

    it("shows GitHub-specific setup instructions for the github preset", () => {
      const wrapper = mount(AddSourceModal, {
        ...globalConfig,
        props: revealStepProps("github", "GitHub"),
      });
      expect(wrapper.text()).toContain("webhook secret");
      expect(wrapper.text()).toContain("GitHub repo's Settings");
    });

    it("shows the shared-secret header name for the zapier preset", () => {
      const wrapper = mount(AddSourceModal, {
        ...globalConfig,
        props: revealStepProps("zapier", "Zapier"),
      });
      expect(wrapper.text()).toContain("shared secret");
      expect(wrapper.text()).toContain("x-markpost-secret");
    });

    it("emits close when 'done' is clicked", async () => {
      const wrapper = mount(AddSourceModal, {
        ...globalConfig,
        props: revealStepProps("github", "GitHub"),
      });
      const doneButton = wrapper
        .findAll("button")
        .find((button) => button.text() === "done");

      await doneButton?.trigger("click");

      expect(wrapper.emitted("close")).toHaveLength(1);
    });
  });
});
