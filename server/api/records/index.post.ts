import { getDb } from "../../db";
import { records } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";
import { recordSerializer, type RecordApiResponse } from "../../utils/response";
import { apiValidate, type AttributeRule } from "../../utils/validate";

type CreateRecordAttributes = {
  title?: string;
  content?: string;
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
];

async function insertRecord(
  db: ReturnType<typeof getDb>,
  userId: string,
  title: string,
  content: string,
) {
  const [created] = await db
    .insert(records)
    .values({ userId, title, content })
    .returning();

  return created;
}

export default defineEventHandler(async (event): Promise<RecordApiResponse> => {
  try {
    const userId = requireUser(event);
    const body = (await readBody(event)) as CreateRecordBody;

    apiValidate(body as ApiRequest, VALIDATION_RULES);

    const attributes = body.data!
      .attributes as Required<CreateRecordAttributes>;
    const record = await insertRecord(
      getDb(),
      userId,
      attributes.title,
      attributes.content,
    );

    setResponseStatus(event, 201);

    return { data: recordSerializer(record) };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
