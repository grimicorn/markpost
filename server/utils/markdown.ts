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

const SLUG_MAX_LENGTH = 80;
const FALLBACK_SLUG = "untitled";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

export function convertHtmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

export function titleToSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, "");

  return slug || FALLBACK_SLUG;
}

function sanitizeSource(source: string): string {
  return source
    .replace(/\.\./g, "")
    .replace(/^\/+/, "")
    .replace(/[^\w/.-]/g, "-");
}

function sanitizeFilePath(filePath: string): string {
  return filePath
    .split("/")
    .filter((segment) => segment !== ".." && segment !== ".")
    .join("/")
    .replace(/^\/+/, "");
}

export function buildFilename(
  template: string,
  date: Date,
  title: string,
  source: string,
): string {
  const dateString = formatDateForFilename(date);
  const slug = titleToSlug(title);
  const safeSource = sanitizeSource(source);

  const assembled = template
    .replace(/\{\{date\}\}/g, dateString)
    .replace(/\{\{slug\}\}/g, slug)
    .replace(/\{\{source\}\}/g, safeSource);

  return sanitizeFilePath(assembled);
}

function formatDateForFilename(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveCreatedDate(rawDate: string): {
  created: string;
  createdDate: Date;
} {
  const candidate = new Date(rawDate);
  if (Number.isNaN(candidate.getTime())) {
    const now = new Date();
    return { created: now.toISOString(), createdDate: now };
  }
  // Normalize to ISO-8601 so non-standard parseable strings (e.g. "2026-01-01 12:00")
  // are stored and serialized consistently.
  return { created: candidate.toISOString(), createdDate: candidate };
}

function quoteYamlScalar(value: string): string {
  const needsQuoting =
    /[:#\[\]{}&!|>'"%@`,]/.test(value) ||
    /\n/.test(value) ||
    value.trim() !== value;
  if (!needsQuoting) {
    return value;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function serializeTagsLine(tags: string[]): string {
  if (tags.length === 0) {
    return "tags: []";
  }
  const quotedTags = tags.map((tag) => quoteYamlScalar(tag)).join(", ");
  return `tags: [${quotedTags}]`;
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
  return [
    "---",
    `title: ${quoteYamlScalar(frontmatter.title)}`,
    `source: ${quoteYamlScalar(frontmatter.source)}`,
    `created: ${frontmatter.created}`,
    serializeTagsLine(frontmatter.tags),
    "---",
  ].join("\n");
}

function buildParsedPayload(
  title: string,
  source: string,
  rawDate: string,
  tags: string[],
  rawContent: string,
  filenameTemplate: string,
): ParsedPayload {
  const { created, createdDate } = resolveCreatedDate(rawDate);
  const frontmatter = buildFrontmatter(title, source, created, tags);
  const filePath = buildFilename(filenameTemplate, createdDate, title, source);
  return { title, body: rawContent, frontmatter, tags, filePath };
}

export function parseWebhookPayload(
  payload: WebhookPayload,
  settings: UserSettings,
): ParsedPayload {
  const title = payload.title ?? "Untitled";
  const source = payload.source ?? "webhook";
  const tags = payload.tags ?? [];
  const rawDate = payload.created ?? new Date().toISOString();
  const rawContent = payload.html
    ? convertHtmlToMarkdown(payload.html)
    : (payload.content ?? "");

  return buildParsedPayload(
    title,
    source,
    rawDate,
    tags,
    rawContent,
    settings.filenameTemplate,
  );
}

export function parseEmailPayload(
  payload: EmailPayload,
  settings: UserSettings,
): ParsedPayload {
  const title = payload.subject ?? "Untitled";
  const source = `email/${payload.from ?? "unknown"}`;
  const tags = payload.tags ?? [];
  const rawDate = payload.date ?? new Date().toISOString();
  const rawContent = payload.html
    ? convertHtmlToMarkdown(payload.html)
    : (payload.text ?? "");

  return buildParsedPayload(
    title,
    source,
    rawDate,
    tags,
    rawContent,
    settings.filenameTemplate,
  );
}

// Assembles the full .md file content from a parsed payload.
// Used by the CLI/sync process when writing to disk; not used for DB storage
// (frontmatter and content are stored in separate columns).
export function assembleMarkdownDocument(parsedPayload: ParsedPayload): string {
  const frontmatterBlock = serializeFrontmatter(parsedPayload.frontmatter);
  return `${frontmatterBlock}\n\n# ${parsedPayload.title}\n\n${parsedPayload.body}`;
}
