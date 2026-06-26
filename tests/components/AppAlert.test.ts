import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppAlert from "../../app/components/AppAlert.vue";
import AppIcon from "../../app/components/AppIcon.vue";

const globalConfig = {
  global: {
    components: { AppIcon },
  },
};

describe("AppAlert", () => {
  it("matches snapshot (default info tone)", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      slots: { default: "Something happened" },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders err tone with triangle icon and error class", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      props: { tone: "err" },
      slots: { default: "Error text" },
    });
    expect(wrapper.classes()).toContain("err");
    expect(wrapper.find(".a-title").text()).toBe("Error");
  });

  it("renders warn tone", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      props: { tone: "warn" },
      slots: { default: "Warning text" },
    });
    expect(wrapper.classes()).toContain("warn");
    expect(wrapper.find(".a-title").text()).toBe("Warning");
  });

  it("renders ok tone", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      props: { tone: "ok" },
      slots: { default: "Success text" },
    });
    expect(wrapper.classes()).toContain("ok");
    expect(wrapper.find(".a-title").text()).toBe("Success");
  });

  it("renders info tone (default)", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      slots: { default: "Info text" },
    });
    expect(wrapper.classes()).toContain("info");
    expect(wrapper.find(".a-title").text()).toBe("Info");
  });

  it("uses custom title when provided", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      props: { title: "Custom title" },
      slots: { default: "body" },
    });
    expect(wrapper.find(".a-title").text()).toBe("Custom title");
  });

  it("hides close button when closeable is false", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      props: { closeable: false },
      slots: { default: "body" },
    });
    expect(wrapper.find(".a-close").exists()).toBe(false);
  });

  it("shows close button when closeable is true", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      props: { closeable: true },
      slots: { default: "body" },
    });
    expect(wrapper.find(".a-close").exists()).toBe(true);
  });

  it("emits close when close button is clicked", async () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      props: { closeable: true },
      slots: { default: "body" },
    });
    await wrapper.find(".a-close").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("renders slot content", () => {
    const wrapper = mount(AppAlert, {
      ...globalConfig,
      slots: { default: "Slot content here" },
    });
    expect(wrapper.find(".a-text").text()).toBe("Slot content here");
  });
});
