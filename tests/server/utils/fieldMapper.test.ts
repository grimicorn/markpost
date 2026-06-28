import { describe, it, expect } from "vitest";
import {
  applyFieldMapping,
  buildRawWebhookPayload,
} from "../../../server/utils/fieldMapper";

describe("buildRawWebhookPayload", () => {
  it("picks title, content, html, tags, created from payload", () => {
    const result = buildRawWebhookPayload(
      {
        title: "Hello",
        content: "Body text",
        html: "<p>Body text</p>",
        tags: ["foo", "bar"],
        created: "2026-06-01T00:00:00Z",
      },
      "My Source",
    );
    expect(result).toEqual({
      title: "Hello",
      content: "Body text",
      html: "<p>Body text</p>",
      source: "My Source",
      tags: ["foo", "bar"],
      created: "2026-06-01T00:00:00Z",
    });
  });

  it("filters non-string values from tags array", () => {
    const result = buildRawWebhookPayload(
      { title: "T", content: "C", tags: ["valid", 42, null, "also-valid"] },
      "src",
    );
    expect(result.tags).toEqual(["valid", "also-valid"]);
  });

  it("returns undefined for missing optional fields", () => {
    const result = buildRawWebhookPayload({ title: "T", content: "C" }, "src");
    expect(result.html).toBeUndefined();
    expect(result.tags).toBeUndefined();
    expect(result.created).toBeUndefined();
  });

  it("sets source to the sourceName when no source field in payload", () => {
    const result = buildRawWebhookPayload(
      { title: "T", content: "C" },
      "MySource",
    );
    expect(result.source).toBe("MySource");
  });
});

describe("applyFieldMapping", () => {
  it("falls back to buildRawWebhookPayload when fieldMapping is null", () => {
    const result = applyFieldMapping(
      { title: "Hello", content: "World" },
      null,
      "src",
    );
    expect(result.title).toBe("Hello");
    expect(result.content).toBe("World");
    expect(result.source).toBe("src");
  });

  it("falls back to buildRawWebhookPayload when fieldMapping is not an object", () => {
    const result = applyFieldMapping(
      { title: "Hello", content: "World" },
      "not-an-object",
      "src",
    );
    expect(result.title).toBe("Hello");
  });

  it("falls back to buildRawWebhookPayload when fieldMapping is an array", () => {
    const result = applyFieldMapping({ title: "T", content: "C" }, [], "src");
    expect(result.source).toBe("src");
  });

  it("maps payload fields using the fieldMapping paths", () => {
    const payload = {
      event: {
        name: "Deployment",
        body: "Deploy succeeded",
        labels: ["infra"],
        timestamp: "2026-06-01T00:00:00Z",
      },
    };
    const mapping = {
      title: "event.name",
      content: "event.body",
      tags: "event.labels",
      created: "event.timestamp",
    };
    const result = applyFieldMapping(payload, mapping, "CI/CD");
    expect(result.title).toBe("Deployment");
    expect(result.content).toBe("Deploy succeeded");
    expect(result.tags).toEqual(["infra"]);
    expect(result.created).toBe("2026-06-01T00:00:00Z");
    expect(result.source).toBe("CI/CD");
  });

  it("returns undefined for missing nested paths", () => {
    const result = applyFieldMapping(
      { top: {} },
      { title: "top.missing.deep" },
      "src",
    );
    expect(result.title).toBeUndefined();
  });

  it("uses sourceName as source when source mapping path is absent", () => {
    const result = applyFieldMapping(
      { name: "My Title", text: "Body" },
      { title: "name", content: "text" },
      "Configured Source",
    );
    expect(result.source).toBe("Configured Source");
  });

  it("uses mapped source value when source path is provided", () => {
    const result = applyFieldMapping(
      { src: "github/my-repo" },
      { source: "src" },
      "fallback",
    );
    expect(result.source).toBe("github/my-repo");
  });
});
