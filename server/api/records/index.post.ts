import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { records, sources, RECORD_STATUSES } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler, ApiError } from "../../utils/errors";
import { recordSerializer, type RecordApiResponse } from "../../utils/response";
import {
  apiValidate,
  isAbsent,
  type AttributeRule,
} from "../../utils/validate";
import { writeEvent } from "../../utils/eventWriter";

type CreateRecordAttributes = {
  title?: string;
  content?: string;
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
};

type CreateRecordBody = {
  data?: {
    type?: string;
    attributes?: CreateRecordAttributes;
  };
};

const VALIDATION_RULES: AttributeRule[] = [
  { key: "title", type: "string" },
  { key: "content", type: "string" },
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

    const attributes = body.data!.attributes as Required<
      Pick<CreateRecordAttributes, "title" | "content">
    > &
      Omit<CreateRecordAttributes, "title" | "content">;

    // Run synchronous shape checks before any DB queries to avoid wasted round-trips.
    validateTagsShape(attributes.tags);
    validateFrontmatterShape(attributes.frontmatter);

    const db = getDb();

    if (attributes.sourceId) {
      await validateSourceOwnership(db, attributes.sourceId, userId);
    }

    const insertValues = buildInsertValues(userId, attributes);
    const record = await insertRecord(db, insertValues);

    const eventKind = record.status === "error" ? "err" : "ok";
    const eventMessage =
      record.status === "error"
        ? `Record created with error: ${record.errorMessage ?? "unknown"}`
        : `Record created: ${record.title ?? "untitled"}`;

    await writeEvent({
      userId,
      kind: eventKind,
      message: eventMessage,
      recordUuid: record.uuid,
      sourceId: record.sourceId ?? null,
    }).catch((writeError) => {
      console.error("[records/create] failed to write event:", writeError);
    });

    setResponseStatus(event, 201);

    return { data: recordSerializer(record) };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
