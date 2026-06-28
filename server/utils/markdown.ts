import TurndownService from "turndown";

export type ParsedPayload = {
  title: string;
  body: string;
  frontmatter: FrontmatterObject;
  tags: string[];
  filePath: string;
};

export type FrontmatterObject = {
  title: string;
  source: string;
  created: string;
  tags: string[];
};

export type WebhookPayload = {
  title?: string;
  content?: string;
  html?: string;
  source?: string;
  tags?: string[];
  created?: string;
};

export type EmailPayload = {
  subject?: string;
  html?: string;
  text?: string;
  from?: string;
  tags?: string[];
  date?: string;
};

export type UserSettings = {
  filenameTemplate: string;
};

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

export function convertHtmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function buildFilename(
  template: string,
  date: Date,
  title: string,
  source: string,
): string {
  const dateString = formatDateForFilename(date);
  const slug = titleToSlug(title);

  return template
    .replace(/\{\{date\}\}/g, dateString)
    .replace(/\{\{slug\}\}/g, slug)
    .replace(/\{\{source\}\}/g, source);
}

function formatDateForFilename(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildFrontmatter(
  title: string,
  source: string,
  created: string,
  tags: string[],
): FrontmatterObject {
  return { title, source, created, tags };
}

export function serializeFrontmatter(frontmatter: FrontmatterObject): string {
  const tagsLine =
    frontmatter.tags.length > 0
      ? `tags: [${frontmatter.tags.join(", ")}]`
      : "tags: []";

  return [
    "---",
    `title: ${frontmatter.title}`,
    `source: ${frontmatter.source}`,
    `created: ${frontmatter.created}`,
    tagsLine,
    "---",
  ].join("\n");
}

export function parseWebhookPayload(
  payload: WebhookPayload,
  settings: UserSettings,
): ParsedPayload {
  const title = payload.title ?? "Untitled";
  const source = payload.source ?? "webhook";
  const tags = payload.tags ?? [];
  const created = payload.created ?? new Date().toISOString();
  const createdDate = new Date(created);

  const rawContent = payload.html
    ? convertHtmlToMarkdown(payload.html)
    : (payload.content ?? "");

  const frontmatter = buildFrontmatter(title, source, created, tags);
  const filePath = buildFilename(
    settings.filenameTemplate,
    createdDate,
    title,
    source,
  );

  return { title, body: rawContent, frontmatter, tags, filePath };
}

export function parseEmailPayload(
  payload: EmailPayload,
  settings: UserSettings,
): ParsedPayload {
  const title = payload.subject ?? "Untitled";
  const source = `email/${payload.from ?? "unknown"}`;
  const tags = payload.tags ?? [];
  const created = payload.date ?? new Date().toISOString();
  const createdDate = new Date(created);

  const rawContent = payload.html
    ? convertHtmlToMarkdown(payload.html)
    : (payload.text ?? "");

  const frontmatter = buildFrontmatter(title, source, created, tags);
  const filePath = buildFilename(
    settings.filenameTemplate,
    createdDate,
    title,
    source,
  );

  return { title, body: rawContent, frontmatter, tags, filePath };
}

export function assembleMarkdownDocument(parsedPayload: ParsedPayload): string {
  const frontmatterBlock = serializeFrontmatter(parsedPayload.frontmatter);
  return `${frontmatterBlock}\n\n# ${parsedPayload.title}\n\n${parsedPayload.body}`;
}
