import { getDb } from "../../db";
import { records, RECORD_STATUSES } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler, ApiError } from "../../utils/errors";
import { recordSerializer, type RecordApiResponse } from "../../utils/response";
import { apiValidate, type AttributeRule } from "../../utils/validate";

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
  syncedAt?: string | null;
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

function parseSyncedAt(raw: string | null): Date | null {
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(
      [
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "SyncedAt must be a valid ISO 8601 date string",
          source: { pointer: "/data/attributes/syncedAt" },
        },
      ],
      422,
    );
  }

  return parsed;
}

function validateTagsShape(value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (!Array.isArray(value)) {
    throw new ApiError(
      [
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "Tags must be an array",
          source: { pointer: "/data/attributes/tags" },
        },
      ],
      422,
    );
  }
}

function validateFrontmatterShape(value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(
      [
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "Frontmatter must be an object",
          source: { pointer: "/data/attributes/frontmatter" },
        },
      ],
      422,
    );
  }
}

function buildInsertValues(
  userId: string,
  attributes: Required<Pick<CreateRecordAttributes, "title" | "content">> &
    Omit<CreateRecordAttributes, "title" | "content">,
): InsertRecordValues {
  validateTagsShape(attributes.tags);
  validateFrontmatterShape(attributes.frontmatter);

  const values: InsertRecordValues = {
    userId,
    title: attributes.title,
    content: attributes.content,
  };

  for (const key of SCALAR_OPTIONAL_KEYS) {
    if ((attributes as Record<ScalarOptionalKey, unknown>)[key] !== undefined) {
      (values as Record<string, unknown>)[key] = (
        attributes as Record<ScalarOptionalKey, unknown>
      )[key];
    }
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

    const insertValues = buildInsertValues(userId, attributes);
    const record = await insertRecord(getDb(), insertValues);

    setResponseStatus(event, 201);

    return { data: recordSerializer(record) };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
