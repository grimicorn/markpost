import { describe, expect, it } from "vitest";
import {
  generateWebhookSlug,
  generateEmailSlug,
  generateEndpointSlug,
} from "../../../server/utils/endpointSlug";

describe("generateWebhookSlug", () => {
  it("returns a slug starting with wh_", () => {
    const slug = generateWebhookSlug();
    expect(slug.startsWith("wh_")).toBe(true);
  });

  it("returns a slug with 8 hex characters after the prefix", () => {
    const slug = generateWebhookSlug();
    const suffix = slug.slice("wh_".length);
    expect(suffix).toHaveLength(8);
    expect(/^[0-9a-f]+$/i.test(suffix)).toBe(true);
  });

  it("generates unique slugs on repeated calls", () => {
    const slugs = Array.from({ length: 20 }, () => generateWebhookSlug());
    const unique = new Set(slugs);
    expect(unique.size).toBe(20);
  });
});

describe("generateEmailSlug", () => {
  it("returns a slug starting with clip-", () => {
    const slug = generateEmailSlug();
    expect(slug.startsWith("clip-")).toBe(true);
  });

  it("returns a slug with 4 hex characters after the prefix", () => {
    const slug = generateEmailSlug();
    const suffix = slug.slice("clip-".length);
    expect(suffix).toHaveLength(4);
    expect(/^[0-9a-f]+$/i.test(suffix)).toBe(true);
  });

  it("generates unique slugs on repeated calls", () => {
    const slugs = Array.from({ length: 20 }, () => generateEmailSlug());
    const unique = new Set(slugs);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("generateEndpointSlug", () => {
  it("generates an email slug for type email", () => {
    const slug = generateEndpointSlug("email");
    expect(slug.startsWith("clip-")).toBe(true);
  });

  it("generates a webhook slug for type webhook", () => {
    const slug = generateEndpointSlug("webhook");
    expect(slug.startsWith("wh_")).toBe(true);
  });

  it("generates a webhook slug for preset types like stripe", () => {
    const slug = generateEndpointSlug("stripe");
    expect(slug.startsWith("wh_")).toBe(true);
  });

  it("generates a webhook slug for preset types like github", () => {
    const slug = generateEndpointSlug("github");
    expect(slug.startsWith("wh_")).toBe(true);
  });
});
