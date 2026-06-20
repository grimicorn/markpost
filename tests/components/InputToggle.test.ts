import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import InputToggle from "../../app/components/InputToggle.vue";

describe("InputToggle", () => {
  it("matches snapshot", () => {
    const wrapper = mount(InputToggle, {
      props: { modelValue: false, label: "Auto-sync" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("reflects modelValue=true as checked", () => {
    const wrapper = mount(InputToggle, {
      props: { modelValue: true },
    });
    expect((wrapper.find("input").element as HTMLInputElement).checked).toBe(true);
  });

  it("reflects modelValue=false as unchecked", () => {
    const wrapper = mount(InputToggle, {
      props: { modelValue: false },
    });
    expect((wrapper.find("input").element as HTMLInputElement).checked).toBe(false);
  });

  it("emits update:modelValue with true when toggled on", async () => {
    const wrapper = mount(InputToggle, {
      props: { modelValue: false },
    });
    await wrapper.find("input").setValue(true);
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([true]);
  });

  it("emits update:modelValue with false when toggled off", async () => {
    const wrapper = mount(InputToggle, {
      props: { modelValue: true },
    });
    await wrapper.find("input").setValue(false);
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([false]);
  });

  it("renders label when provided", () => {
    const wrapper = mount(InputToggle, {
      props: { modelValue: false, label: "Enable feature" },
    });
    expect(wrapper.text()).toContain("Enable feature");
  });

  it("does not render label span when label is absent", () => {
    const wrapper = mount(InputToggle, {
      props: { modelValue: false },
    });
    expect(wrapper.find("span[style]").exists()).toBe(false);
  });
});
