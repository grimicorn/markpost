import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { records } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import { recordSerializer, type RecordApiResponse } from "../../utils/response";
import { isValidUuid } from "../../utils/uuid";

function invalidUuidError(): ApiError {
  return new ApiError(
    [
      {
        status: "400",
        title: "Invalid Parameter",
        detail: "The uuid parameter is missing or malformed.",
        source: { parameter: "uuid" },
      },
    ],
    400,
  );
}

function notFoundError(): ApiError {
  return new ApiError(
    [
      {
        status: "404",
        title: "Not Found",
        detail: "No record was found for the given uuid.",
      },
    ],
    404,
  );
}

export async function findRecordForUser(
  db: ReturnType<typeof getDb>,
  uuid: string,
  userId: string,
) {
  const rows = await db
    .select()
    .from(records)
    .where(and(eq(records.uuid, uuid), eq(records.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export default defineEventHandler(async (event): Promise<RecordApiResponse> => {
  try {
    const userId = requireUser(event);
    const uuid = getRouterParam(event, "uuid");

    if (!isValidUuid(uuid)) {
      throw invalidUuidError();
    }

    const record = await findRecordForUser(getDb(), uuid, userId);

    if (!record) {
      throw notFoundError();
    }

    return { data: recordSerializer(record) };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
