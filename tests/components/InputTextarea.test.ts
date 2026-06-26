import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import InputTextarea from "../../app/components/InputTextarea.vue";
import AppField from "../../app/components/AppField.vue";
import AppIcon from "../../app/components/AppIcon.vue";

const globalConfig = {
  global: {
    components: { AppField, AppIcon },
  },
};

describe("InputTextarea", () => {
  it("matches snapshot", () => {
    const wrapper = mount(InputTextarea, {
      ...globalConfig,
      props: { label: "Notes", modelValue: "" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("emits update:modelValue on input", async () => {
    const wrapper = mount(InputTextarea, {
      ...globalConfig,
      props: { modelValue: "" },
    });
    await wrapper.find("textarea").setValue("hello world");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["hello world"]);
  });

  it("renders the passed modelValue", () => {
    const wrapper = mount(InputTextarea, {
      ...globalConfig,
      props: { modelValue: "existing text" },
    });
    expect(
      (wrapper.find("textarea").element as HTMLTextAreaElement).value,
    ).toBe("existing text");
  });

  it("applies err state class", () => {
    const wrapper = mount(InputTextarea, {
      ...globalConfig,
      props: { modelValue: "", state: "err" },
    });
    expect(wrapper.find(".field").classes()).toContain("err");
  });

  it("applies ok state class", () => {
    const wrapper = mount(InputTextarea, {
      ...globalConfig,
      props: { modelValue: "", state: "ok" },
    });
    expect(wrapper.find(".field").classes()).toContain("ok");
  });

  it("passes rows prop to textarea", () => {
    const wrapper = mount(InputTextarea, {
      ...globalConfig,
      props: { modelValue: "", rows: 8 },
    });
    expect(wrapper.find("textarea").attributes("rows")).toBe("8");
  });
});
