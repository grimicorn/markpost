import { describe, it, expect } from "vitest";
import {
  convertHtmlToMarkdown,
  titleToSlug,
  buildFilename,
  buildFrontmatter,
  serializeFrontmatter,
  parseWebhookPayload,
  parseEmailPayload,
  assembleMarkdownDocument,
} from "../../../server/utils/markdown";

describe("convertHtmlToMarkdown", () => {
  it("converts a paragraph to plain text", () => {
    const result = convertHtmlToMarkdown("<p>Hello world</p>");
    expect(result).toBe("Hello world");
  });

  it("converts a heading", () => {
    const result = convertHtmlToMarkdown("<h1>Deploy succeeded</h1>");
    expect(result).toBe("# Deploy succeeded");
  });

  it("converts bold text", () => {
    const result = convertHtmlToMarkdown(
      "<p>Commit <strong>a1f9c20</strong> shipped</p>",
    );
    expect(result).toBe("Commit **a1f9c20** shipped");
  });

  it("converts an unordered list", () => {
    const result = convertHtmlToMarkdown(
      "<ul><li>Alpha</li><li>Beta</li></ul>",
    );
    // turndown uses bulletListMarker "-" with trailing spaces before the item text
    expect(result).toContain("Alpha");
    expect(result).toContain("Beta");
    expect(result).toMatch(/^-/);
  });

  it("returns empty string for empty HTML", () => {
    const result = convertHtmlToMarkdown("");
    expect(result).toBe("");
  });

  it("strips tags for unsupported elements", () => {
    const result = convertHtmlToMarkdown("<span>plain</span>");
    expect(result).toBe("plain");
  });
});

describe("titleToSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(titleToSlug("Production Deploy Succeeded")).toBe(
      "production-deploy-succeeded",
    );
  });

  it("removes non-alphanumeric characters", () => {
    expect(titleToSlug("Hello, World! (2026)")).toBe("hello-world-2026");
  });

  it("collapses multiple hyphens into one", () => {
    expect(titleToSlug("hello   world")).toBe("hello-world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(titleToSlug("  hello world  ")).toBe("hello-world");
  });

  it("truncates at 80 characters", () => {
    const longTitle = "a".repeat(100);
    expect(titleToSlug(longTitle).length).toBeLessThanOrEqual(80);
  });

  it("returns empty string for an empty title", () => {
    expect(titleToSlug("")).toBe("");
  });
});

describe("buildFilename", () => {
  const referenceDate = new Date("2026-06-14T09:41:02Z");

  it("replaces {{date}} with YYYY-MM-DD", () => {
    const result = buildFilename(
      "{{date}}-{{slug}}.md",
      referenceDate,
      "Production Deploy",
      "webhook",
    );
    expect(result).toBe("2026-06-14-production-deploy.md");
  });

  it("replaces {{source}} in the template", () => {
    const result = buildFilename(
      "{{source}}/{{slug}}.md",
      referenceDate,
      "Deploy",
      "github",
    );
    expect(result).toBe("github/deploy.md");
  });

  it("replaces {{slug}} with a slugified title", () => {
    const result = buildFilename(
      "{{slug}}.md",
      referenceDate,
      "Hello World",
      "webhook",
    );
    expect(result).toBe("hello-world.md");
  });

  it("replaces all occurrences when a token appears multiple times", () => {
    const result = buildFilename(
      "{{date}}/{{date}}-{{slug}}.md",
      referenceDate,
      "My Note",
      "webhook",
    );
    expect(result).toBe("2026-06-14/2026-06-14-my-note.md");
  });
});

describe("buildFrontmatter", () => {
  it("builds a frontmatter object with all fields", () => {
    const result = buildFrontmatter(
      "Production deploy succeeded",
      "webhook/github",
      "2026-06-14T09:41:02Z",
      ["ci", "deploy"],
    );

    expect(result).toEqual({
      title: "Production deploy succeeded",
      source: "webhook/github",
      created: "2026-06-14T09:41:02Z",
      tags: ["ci", "deploy"],
    });
  });

  it("accepts an empty tags array", () => {
    const result = buildFrontmatter(
      "Note",
      "webhook",
      "2026-06-14T00:00:00Z",
      [],
    );
    expect(result.tags).toEqual([]);
  });
});

describe("serializeFrontmatter", () => {
  it("serializes a frontmatter object to YAML block", () => {
    const frontmatter = buildFrontmatter(
      "Production deploy succeeded",
      "webhook/github",
      "2026-06-14T09:41:02Z",
      ["ci", "deploy", "incoming"],
    );

    const result = serializeFrontmatter(frontmatter);

    expect(result).toBe(
      "---\ntitle: Production deploy succeeded\nsource: webhook/github\ncreated: 2026-06-14T09:41:02Z\ntags: [ci, deploy, incoming]\n---",
    );
  });

  it("serializes empty tags as an empty array", () => {
    const frontmatter = buildFrontmatter(
      "Note",
      "webhook",
      "2026-06-14T00:00:00Z",
      [],
    );
    const result = serializeFrontmatter(frontmatter);
    expect(result).toContain("tags: []");
  });
});

describe("parseWebhookPayload", () => {
  const settings = { filenameTemplate: "{{date}}-{{slug}}.md" };

  it("extracts title, body, frontmatter, tags, and filePath from a JSON payload with html", () => {
    const payload = {
      title: "Production deploy succeeded",
      html: "<p>Commit <strong>a1f9c20</strong> shipped to prod</p>",
      source: "webhook/github",
      tags: ["ci", "deploy"],
      created: "2026-06-14T09:41:02Z",
    };

    const result = parseWebhookPayload(payload, settings);

    expect(result.title).toBe("Production deploy succeeded");
    expect(result.body).toContain("a1f9c20");
    expect(result.body).toContain("shipped to prod");
    expect(result.frontmatter).toEqual({
      title: "Production deploy succeeded",
      source: "webhook/github",
      created: "2026-06-14T09:41:02Z",
      tags: ["ci", "deploy"],
    });
    expect(result.tags).toEqual(["ci", "deploy"]);
    expect(result.filePath).toBe("2026-06-14-production-deploy-succeeded.md");
  });

  it("falls back to plain text content when no html field is present", () => {
    const payload = {
      title: "Plain text note",
      content: "Just some text",
      source: "webhook/github",
      created: "2026-06-14T09:41:02Z",
    };

    const result = parseWebhookPayload(payload, settings);

    expect(result.body).toBe("Just some text");
  });

  it("uses defaults when optional fields are absent", () => {
    const payload = {
      title: "Bare minimum",
      content: "body",
    };

    const result = parseWebhookPayload(payload, settings);

    expect(result.frontmatter.source).toBe("webhook");
    expect(result.tags).toEqual([]);
    expect(result.filePath).toMatch(/^\d{4}-\d{2}-\d{2}-bare-minimum\.md$/);
  });

  it("falls back to Untitled when title is absent", () => {
    const payload = { content: "something" };
    const result = parseWebhookPayload(payload, settings);
    expect(result.title).toBe("Untitled");
  });

  it("uses a custom filename template from settings", () => {
    const customSettings = { filenameTemplate: "{{source}}/{{slug}}.md" };
    const payload = {
      title: "Deploy",
      html: "<p>done</p>",
      source: "github",
      created: "2026-06-14T00:00:00Z",
    };

    const result = parseWebhookPayload(payload, customSettings);

    expect(result.filePath).toBe("github/deploy.md");
  });
});

describe("parseEmailPayload", () => {
  const settings = { filenameTemplate: "{{date}}-{{slug}}.md" };

  it("extracts title from subject and converts html body", () => {
    const payload = {
      subject: "Weekly digest",
      html: "<p>Here are <strong>5 updates</strong> this week.</p>",
      from: "newsletters@example.com",
      date: "2026-06-14T08:00:00Z",
      tags: ["newsletter"],
    };

    const result = parseEmailPayload(payload, settings);

    expect(result.title).toBe("Weekly digest");
    expect(result.body).toContain("5 updates");
    expect(result.frontmatter).toEqual({
      title: "Weekly digest",
      source: "email/newsletters@example.com",
      created: "2026-06-14T08:00:00Z",
      tags: ["newsletter"],
    });
    expect(result.filePath).toBe("2026-06-14-weekly-digest.md");
  });

  it("falls back to plain text when no html field is present", () => {
    const payload = {
      subject: "Plain email",
      text: "Just plain text content",
      from: "user@example.com",
      date: "2026-06-14T08:00:00Z",
    };

    const result = parseEmailPayload(payload, settings);

    expect(result.body).toBe("Just plain text content");
  });

  it("uses Untitled when subject is absent", () => {
    const payload = { text: "hello", date: "2026-06-14T08:00:00Z" };
    const result = parseEmailPayload(payload, settings);
    expect(result.title).toBe("Untitled");
  });

  it("sets source to email/unknown when from is absent", () => {
    const payload = { subject: "Note", text: "body" };
    const result = parseEmailPayload(payload, settings);
    expect(result.frontmatter.source).toBe("email/unknown");
  });
});

describe("assembleMarkdownDocument", () => {
  it("combines frontmatter block and body into a full markdown document", () => {
    const parsedPayload = {
      title: "Deploy",
      body: "Commit a1f9c20 shipped.",
      frontmatter: buildFrontmatter(
        "Deploy",
        "webhook/github",
        "2026-06-14T09:41:02Z",
        ["ci"],
      ),
      tags: ["ci"],
      filePath: "2026-06-14-deploy.md",
    };

    const result = assembleMarkdownDocument(parsedPayload);

    expect(result).toContain("---\ntitle: Deploy");
    expect(result).toContain("# Deploy");
    expect(result).toContain("Commit a1f9c20 shipped.");
  });

  it("places frontmatter before the heading", () => {
    const parsedPayload = {
      title: "My Note",
      body: "Content here.",
      frontmatter: buildFrontmatter(
        "My Note",
        "webhook",
        "2026-06-14T00:00:00Z",
        [],
      ),
      tags: [],
      filePath: "2026-06-14-my-note.md",
    };

    const result = assembleMarkdownDocument(parsedPayload);
    const frontmatterEnd = result.indexOf("---\n\n");

    expect(frontmatterEnd).toBeGreaterThan(-1);
    expect(result.indexOf("# My Note")).toBeGreaterThan(frontmatterEnd);
  });
});
