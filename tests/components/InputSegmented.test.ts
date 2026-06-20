import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import InputSegmented from "../../app/components/InputSegmented.vue";

describe("InputSegmented", () => {
  it("matches snapshot", () => {
    const wrapper = mount(InputSegmented, {
      props: {
        modelValue: "a",
        options: ["a", "b", "c"],
      },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders string options as buttons", () => {
    const wrapper = mount(InputSegmented, {
      props: {
        modelValue: "a",
        options: ["a", "b", "c"],
      },
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].text()).toBe("a");
    expect(buttons[1].text()).toBe("b");
  });

  it("marks active option with 'on' class", () => {
    const wrapper = mount(InputSegmented, {
      props: {
        modelValue: "b",
        options: ["a", "b", "c"],
      },
    });
    const buttons = wrapper.findAll("button");
    expect(buttons[0].classes()).not.toContain("on");
    expect(buttons[1].classes()).toContain("on");
    expect(buttons[2].classes()).not.toContain("on");
  });

  it("emits update:modelValue with the selected value on click", async () => {
    const wrapper = mount(InputSegmented, {
      props: {
        modelValue: "a",
        options: ["a", "b", "c"],
      },
    });
    await wrapper.findAll("button")[2].trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["c"]);
  });

  it("normalizes object options", () => {
    const wrapper = mount(InputSegmented, {
      props: {
        modelValue: "monthly",
        options: [
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
        ],
      },
    });
    const buttons = wrapper.findAll("button");
    expect(buttons[0].text()).toBe("Monthly");
    expect(buttons[1].text()).toBe("Yearly");
  });

  it("active class works with object options", () => {
    const wrapper = mount(InputSegmented, {
      props: {
        modelValue: "yearly",
        options: [
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
        ],
      },
    });
    const buttons = wrapper.findAll("button");
    expect(buttons[0].classes()).not.toContain("on");
    expect(buttons[1].classes()).toContain("on");
  });
});
