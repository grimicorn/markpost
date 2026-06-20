import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import InputText from "../../app/components/InputText.vue";
import AppField from "../../app/components/AppField.vue";
import AppIcon from "../../app/components/AppIcon.vue";

const globalConfig = {
  global: {
    components: { AppField, AppIcon },
  },
};

describe("InputText", () => {
  it("matches snapshot", () => {
    const wrapper = mount(InputText, {
      ...globalConfig,
      props: { label: "Email", modelValue: "" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("emits update:modelValue on input", async () => {
    const wrapper = mount(InputText, {
      ...globalConfig,
      props: { modelValue: "" },
    });
    const input = wrapper.find("input");
    await input.setValue("hello");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["hello"]);
  });

  it("emits blur on blur", async () => {
    const wrapper = mount(InputText, {
      ...globalConfig,
      props: { modelValue: "" },
    });
    await wrapper.find("input").trigger("blur");
    expect(wrapper.emitted("blur")).toHaveLength(1);
  });

  it("renders err state class on field", () => {
    const wrapper = mount(InputText, {
      ...globalConfig,
      props: { modelValue: "", state: "err", msg: "Required" },
    });
    expect(wrapper.find(".field").classes()).toContain("err");
  });

  it("renders ok state class on field", () => {
    const wrapper = mount(InputText, {
      ...globalConfig,
      props: { modelValue: "", state: "ok", msg: "Looks good" },
    });
    expect(wrapper.find(".field").classes()).toContain("ok");
  });

  it("shows lead icon when leadIcon prop is given", () => {
    const wrapper = mount(InputText, {
      ...globalConfig,
      props: { modelValue: "", leadIcon: "search" },
    });
    expect(wrapper.find(".lead-addon").exists()).toBe(true);
    expect(wrapper.find(".has-lead").exists()).toBe(true);
  });

  it("does not show lead addon without leadIcon", () => {
    const wrapper = mount(InputText, {
      ...globalConfig,
      props: { modelValue: "" },
    });
    expect(wrapper.find(".lead-addon").exists()).toBe(false);
    expect(wrapper.find(".has-lead").exists()).toBe(false);
  });

  it("passes value to input", () => {
    const wrapper = mount(InputText, {
      ...globalConfig,
      props: { modelValue: "test value" },
    });
    expect((wrapper.find("input").element as HTMLInputElement).value).toBe(
      "test value",
    );
  });
});
