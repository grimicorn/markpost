import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  records,
  sources,
  userSettings,
  RECORD_STATUSES,
} from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler, ApiError } from "../../utils/errors";
import {
  parseWebhookPayload,
  parseEmailPayload,
  type WebhookPayload,
  type EmailPayload,
  type UserSettings,
} from "../../utils/markdown";
import { recordSerializer, type RecordApiResponse } from "../../utils/response";
import {
  apiValidate,
  isAbsent,
  type AttributeRule,
} from "../../utils/validate";

const DEFAULT_FILENAME_TEMPLATE = "{{date}}-{{slug}}.md";

type CreateRecordAttributes = {
  title?: string;
  content?: string;
  // html triggers the Markdown pipeline: converted to content + frontmatter + tags + filePath
  html?: string;
  // payloadType controls which parser runs when html is present; defaults to "webhook"
  payloadType?: "webhook" | "email";
  sourceId?: string | null;
  source?: string | null;
  // status, syncedAt, filePath, and errorMessage are intentionally client-settable on create
  // to support import flows (e.g. CLI bulk-importing already-synced records).
  status?: string;
  filePath?: string | null;
  tags?: unknown;
  frontmatter?: unknown;
  syncedAt?: unknown;
  errorMessage?: string | null;
  // passed through to email parser when payloadType is "email"
  emailFrom?: string | null;
  created?: string | null;
};

type CreateRecordBody = {
  data?: {
    type?: string;
    attributes?: CreateRecordAttributes;
  };
};

const PAYLOAD_TYPES = ["webhook", "email"] as const;

const VALIDATION_RULES: AttributeRule[] = [
  { key: "title", type: "string" },
  // content is optional when html is provided; the pipeline derives content from html
  { key: "content", type: "string", optional: true },
  { key: "html", type: "string", optional: true },
  { key: "payloadType", type: "string", optional: true, enum: PAYLOAD_TYPES },
  { key: "sourceId", type: "string", optional: true },
  { key: "source", type: "string", optional: true },
  { key: "status", type: "string", optional: true, enum: RECORD_STATUSES },
  { key: "filePath", type: "string", optional: true },
  { key: "errorMessage", type: "string", optional: true },
];

// Scalar optional keys that are copied to the insert values as-is (no coercion needed).
const SCALAR_OPTIONAL_KEYS = [
  "sourceId",
  "source",
  "status",
  "filePath",
  "tags",
  "frontmatter",
  "errorMessage",
] as const;

type Database = ReturnType<typeof getDb>;

type ScalarOptionalKey = (typeof SCALAR_OPTIONAL_KEYS)[number];

type InsertRecordValues = {
  userId: string;
  title: string;
  content: string;
  sourceId?: string | null;
  source?: string | null;
  status?: string;
  filePath?: string | null;
  tags?: unknown;
  frontmatter?: unknown;
  syncedAt?: Date | null;
  errorMessage?: string | null;
};

function invalidAttribute(detail: string, pointer: string): ApiError {
  return new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail,
        source: { pointer },
      },
    ],
    422,
  );
}

function parseSyncedAt(raw: unknown): Date | null {
  if (raw === null) {
    return null;
  }

  if (typeof raw !== "string") {
    throw invalidAttribute(
      "SyncedAt must be a date string",
      "/data/attributes/syncedAt",
    );
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw invalidAttribute(
      "SyncedAt must be a valid date string",
      "/data/attributes/syncedAt",
    );
  }

  return parsed;
}

function validateTagsShape(value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (!Array.isArray(value)) {
    throw invalidAttribute("Tags must be an array", "/data/attributes/tags");
  }
}

function validateFrontmatterShape(value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw invalidAttribute(
      "Frontmatter must be an object",
      "/data/attributes/frontmatter",
    );
  }
}

function validateContentOrHtml(attributes: CreateRecordAttributes): void {
  if (!isAbsent(attributes.content) || !isAbsent(attributes.html)) {
    return;
  }

  throw new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail: "Content or html is required",
        source: { pointer: "/data/attributes/content" },
      },
    ],
    422,
  );
}

async function fetchFilenameTemplate(
  database: Database,
  userId: string,
): Promise<string> {
  const [row] = await database
    .select({ filenameTemplate: userSettings.filenameTemplate })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return row?.filenameTemplate ?? DEFAULT_FILENAME_TEMPLATE;
}

type ResolvedContent = {
  content: string;
  frontmatter: unknown;
  tags: unknown;
  filePath: string | null;
};

function buildEmailPayload(attributes: CreateRecordAttributes): EmailPayload {
  return {
    subject: attributes.title,
    html: attributes.html,
    from: attributes.emailFrom ?? undefined,
    tags: Array.isArray(attributes.tags)
      ? (attributes.tags as string[])
      : undefined,
    date: attributes.created ?? undefined,
  };
}

function buildWebhookPayload(
  attributes: CreateRecordAttributes,
): WebhookPayload {
  return {
    title: attributes.title,
    html: attributes.html,
    source: attributes.source ?? undefined,
    tags: Array.isArray(attributes.tags)
      ? (attributes.tags as string[])
      : undefined,
    created: attributes.created ?? undefined,
  };
}

function parsedPayloadToResolvedContent(parsed: {
  body: string;
  frontmatter: unknown;
  tags: string[];
  filePath: string;
}): ResolvedContent {
  return {
    content: parsed.body,
    frontmatter: parsed.frontmatter,
    tags: parsed.tags,
    filePath: parsed.filePath,
  };
}

function resolveContentFromHtml(
  attributes: CreateRecordAttributes,
  settings: UserSettings,
): ResolvedContent {
  const payloadType = attributes.payloadType ?? "webhook";

  if (payloadType === "email") {
    const emailPayload = buildEmailPayload(attributes);
    return parsedPayloadToResolvedContent(
      parseEmailPayload(emailPayload, settings),
    );
  }

  const webhookPayload = buildWebhookPayload(attributes);
  return parsedPayloadToResolvedContent(
    parseWebhookPayload(webhookPayload, settings),
  );
}

async function applyMarkdownPipeline(
  attributes: CreateRecordAttributes,
  database: Database,
  userId: string,
): Promise<CreateRecordAttributes> {
  if (isAbsent(attributes.html)) {
    return attributes;
  }

  const filenameTemplate = await fetchFilenameTemplate(database, userId);
  const userSettingsValues: UserSettings = { filenameTemplate };

  const resolved = resolveContentFromHtml(attributes, userSettingsValues);

  return {
    ...attributes,
    content: attributes.content ?? resolved.content,
    frontmatter: attributes.frontmatter ?? resolved.frontmatter,
    tags: attributes.tags ?? resolved.tags,
    filePath: attributes.filePath ?? resolved.filePath,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function validateSourceOwnership(
  db: ReturnType<typeof getDb>,
  sourceId: string,
  userId: string,
): Promise<void> {
  if (!UUID_PATTERN.test(sourceId)) {
    throw invalidAttribute(
      "SourceId must be a valid UUID",
      "/data/attributes/sourceId",
    );
  }

  const [matchedSource] = await db
    .select({ uuid: sources.uuid })
    .from(sources)
    .where(and(eq(sources.uuid, sourceId), eq(sources.userId, userId)));

  if (!matchedSource) {
    throw invalidAttribute(
      "Source not found or does not belong to you",
      "/data/attributes/sourceId",
    );
  }
}

function buildInsertValues(
  userId: string,
  attributes: Required<Pick<CreateRecordAttributes, "title" | "content">> &
    Omit<CreateRecordAttributes, "title" | "content">,
): InsertRecordValues {
  const values: InsertRecordValues = {
    userId,
    title: attributes.title,
    content: attributes.content,
  };

  for (const key of SCALAR_OPTIONAL_KEYS) {
    const value = (attributes as Record<ScalarOptionalKey, unknown>)[key];

    if (isAbsent(value)) {
      continue;
    }

    (values as Record<string, unknown>)[key] = value;
  }

  if (attributes.syncedAt !== undefined) {
    values.syncedAt = parseSyncedAt(attributes.syncedAt);
  }

  return values;
}

async function insertRecord(
  db: ReturnType<typeof getDb>,
  insertValues: InsertRecordValues,
) {
  const [created] = await db.insert(records).values(insertValues).returning();

  return created;
}

export default defineEventHandler(async (event): Promise<RecordApiResponse> => {
  try {
    const userId = requireUser(event);
    const body = (await readBody(event)) as CreateRecordBody;

    apiValidate(body as ApiRequest, VALIDATION_RULES);

    const rawAttributes = body.data!.attributes as CreateRecordAttributes;

    // Ensure at least one of content or html is present before hitting the DB.
    validateContentOrHtml(rawAttributes);

    // Run synchronous shape checks before any DB queries to avoid wasted round-trips.
    validateTagsShape(rawAttributes.tags);
    validateFrontmatterShape(rawAttributes.frontmatter);

    const db = getDb();

    // Apply markdown pipeline when html is present; this may fetch user settings.
    const attributes = (await applyMarkdownPipeline(
      rawAttributes,
      db,
      userId,
    )) as Required<Pick<CreateRecordAttributes, "title" | "content">> &
      Omit<CreateRecordAttributes, "title" | "content">;

    if (attributes.sourceId) {
      await validateSourceOwnership(db, attributes.sourceId, userId);
    }

    const insertValues = buildInsertValues(userId, attributes);
    const record = await insertRecord(db, insertValues);

    setResponseStatus(event, 201);

    return { data: recordSerializer(record) };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
