import type { WebhookPayload } from "./markdown";

export type FieldMappingConfig = {
  title?: string;
  content?: string;
  html?: string;
  source?: string;
  tags?: string;
  created?: string;
};

function isFieldMappingConfig(value: unknown): value is FieldMappingConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const validKeys: Array<keyof FieldMappingConfig> = [
    "title",
    "content",
    "html",
    "source",
    "tags",
    "created",
  ];

  for (const key of validKeys) {
    if (key in candidate && typeof candidate[key] !== "string") {
      return false;
    }
  }

  return true;
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function getNestedValue(
  payload: Record<string, unknown>,
  path: string,
): unknown {
  const segments = path.split(".");
  let current: unknown = payload;

  for (const segment of segments) {
    if (FORBIDDEN_KEYS.has(segment)) {
      return undefined;
    }

    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function pickStringField(
  payload: Record<string, unknown>,
  path: string | undefined,
): string | undefined {
  if (!path) {
    return undefined;
  }

  const value = getNestedValue(payload, path);

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}

function pickTagsField(
  payload: Record<string, unknown>,
  path: string | undefined,
): string[] | undefined {
  if (!path) {
    return undefined;
  }

  const value = getNestedValue(payload, path);

  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function applyFieldMapping(
  payload: Record<string, unknown>,
  rawFieldMapping: unknown,
  sourceName: string,
): WebhookPayload {
  if (!isFieldMappingConfig(rawFieldMapping)) {
    return buildRawWebhookPayload(payload, sourceName);
  }

  return {
    title: pickStringField(payload, rawFieldMapping.title),
    content: pickStringField(payload, rawFieldMapping.content),
    html: pickStringField(payload, rawFieldMapping.html),
    source: pickStringField(payload, rawFieldMapping.source) ?? sourceName,
    tags: pickTagsField(payload, rawFieldMapping.tags),
    created: pickStringField(payload, rawFieldMapping.created),
  };
}

export function buildRawWebhookPayload(
  payload: Record<string, unknown>,
  sourceName: string,
): WebhookPayload {
  const title = typeof payload.title === "string" ? payload.title : undefined;
  const content =
    typeof payload.content === "string" ? payload.content : undefined;
  const html = typeof payload.html === "string" ? payload.html : undefined;
  const tags = Array.isArray(payload.tags)
    ? payload.tags.filter((item): item is string => typeof item === "string")
    : undefined;
  const created =
    typeof payload.created === "string" ? payload.created : undefined;

  return {
    title,
    content,
    html,
    source: sourceName,
    tags,
    created,
  };
}
