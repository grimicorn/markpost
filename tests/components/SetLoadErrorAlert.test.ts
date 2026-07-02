import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SetLoadErrorAlert from "../../app/components/settings/SetLoadErrorAlert.vue";

const globalConfig = {
  global: {
    stubs: {
      AppAlert: {
        template: '<div class="app-alert" :data-tone="tone"><slot /></div>',
        props: ["tone", "title"],
      },
      AppBtn: {
        template:
          '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        props: ["variant", "size", "disabled"],
        emits: ["click"],
      },
      AppIcon: true,
    },
  },
};

describe("SetLoadErrorAlert", () => {
  it("matches snapshot", () => {
    const wrapper = mount(SetLoadErrorAlert, {
      ...globalConfig,
      props: { message: "DB unavailable." },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the message", () => {
    const wrapper = mount(SetLoadErrorAlert, {
      ...globalConfig,
      props: { message: "DB unavailable." },
    });
    expect(wrapper.text()).toContain("DB unavailable.");
  });

  it("emits retry when the retry button is clicked", async () => {
    const wrapper = mount(SetLoadErrorAlert, {
      ...globalConfig,
      props: { message: "DB unavailable." },
    });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });

  it("disables the retry button while retrying", () => {
    const wrapper = mount(SetLoadErrorAlert, {
      ...globalConfig,
      props: { message: "DB unavailable.", retrying: true },
    });
    expect((wrapper.find("button").element as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("does not disable the retry button by default", () => {
    const wrapper = mount(SetLoadErrorAlert, {
      ...globalConfig,
      props: { message: "DB unavailable." },
    });
    expect((wrapper.find("button").element as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
