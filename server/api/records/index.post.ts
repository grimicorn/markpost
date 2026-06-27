import { getDb } from "../../db";
import { records, RECORD_STATUSES } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";
import { recordSerializer, type RecordApiResponse } from "../../utils/response";
import { apiValidate, type AttributeRule } from "../../utils/validate";

type CreateRecordAttributes = {
  title?: string;
  content?: string;
  sourceId?: string | null;
  source?: string | null;
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

  if (attributes.sourceId !== undefined) {
    values.sourceId = attributes.sourceId;
  }
  if (attributes.source !== undefined) {
    values.source = attributes.source;
  }
  if (attributes.status !== undefined) {
    values.status = attributes.status;
  }
  if (attributes.filePath !== undefined) {
    values.filePath = attributes.filePath;
  }
  if (attributes.tags !== undefined) {
    values.tags = attributes.tags;
  }
  if (attributes.frontmatter !== undefined) {
    values.frontmatter = attributes.frontmatter;
  }
  if (attributes.syncedAt !== undefined) {
    values.syncedAt = attributes.syncedAt
      ? new Date(attributes.syncedAt)
      : null;
  }
  if (attributes.errorMessage !== undefined) {
    values.errorMessage = attributes.errorMessage;
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
