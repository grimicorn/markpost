import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TokenExpiryFields from "../../app/components/settings/TokenExpiryFields.vue";
import {
  MAX_TOKEN_EXPIRY_DAYS,
  MIN_TOKEN_EXPIRY_DAYS,
} from "../../shared/utils/tokens";

describe("TokenExpiryFields", () => {
  it("matches snapshot when expiry is not opted into", () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: false, expiryDays: 90 },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot when expiry is opted into", () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: true, expiryDays: 90 },
    });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("hides the days input when wantsExpiry is false", () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: false, expiryDays: 90 },
    });
    expect(wrapper.find("input[type='number']").exists()).toBe(false);
  });

  it("shows the days input when wantsExpiry is true", () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: true, expiryDays: 90 },
    });
    expect(wrapper.find("input[type='number']").exists()).toBe(true);
  });

  it("emits update:wantsExpiry when the checkbox is toggled", async () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: false, expiryDays: 90 },
    });

    await wrapper.find("input[type='checkbox']").setValue(true);

    expect(wrapper.emitted("update:wantsExpiry")).toEqual([[true]]);
  });

  it("emits update:expiryDays with the numeric value when the days input changes", async () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: true, expiryDays: 90 },
    });

    await wrapper.find("input[type='number']").setValue(30);

    expect(wrapper.emitted("update:expiryDays")).toEqual([[30]]);
  });

  it("binds min and max to the shared expiry day bounds", () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: true, expiryDays: 90 },
    });

    const daysInput = wrapper.find("input[type='number']");
    expect(daysInput.attributes("min")).toBe(String(MIN_TOKEN_EXPIRY_DAYS));
    expect(daysInput.attributes("max")).toBe(String(MAX_TOKEN_EXPIRY_DAYS));
  });

  it("emits NaN when the days input is cleared", async () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: true, expiryDays: 90 },
    });

    await wrapper.find("input[type='number']").setValue("");

    expect(wrapper.emitted("update:expiryDays")).toEqual([[NaN]]);
  });

  it("renders an empty (not '0' or 'NaN') days input when expiryDays is NaN", () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: true, expiryDays: NaN },
    });

    const daysInput = wrapper.find("input[type='number']")
      .element as HTMLInputElement;
    expect(daysInput.value).toBe("");
  });

  it("disables both inputs when disabled is true", () => {
    const wrapper = mount(TokenExpiryFields, {
      props: { wantsExpiry: true, expiryDays: 90, disabled: true },
    });

    expect(
      wrapper.find("input[type='checkbox']").attributes("disabled"),
    ).not.toBeUndefined();
    expect(
      wrapper.find("input[type='number']").attributes("disabled"),
    ).not.toBeUndefined();
  });
});
