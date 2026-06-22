import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { records } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import { apiValidate } from "../../utils/validate";
import type { ApiRequest } from "../../types/api.types";

type DeleteRecordsBody = ApiRequest & {
  data: {
    attributes: {
      uuids?: unknown;
    };
  };
};

type DeleteRecordsResponse = {
  meta: { deleted: number };
};

function validateUuids(body: DeleteRecordsBody): string[] {
  apiValidate(body, [
    {
      key: "uuids",
      message: "Uuids is required and must be a non-empty array",
    },
  ]);

  const uuids = body.data?.attributes?.uuids;

  if (!Array.isArray(uuids) || uuids.length === 0) {
    throw new ApiError(
      [
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "Uuids is required and must be a non-empty array",
          source: { pointer: "/data/attributes/uuids" },
        },
      ],
      422,
    );
  }

  if (!uuids.every((uuid) => typeof uuid === "string")) {
    throw new ApiError(
      [
        {
          status: "422",
          title: "Invalid Attribute",
          detail: "All uuids must be strings",
          source: { pointer: "/data/attributes/uuids" },
        },
      ],
      422,
    );
  }

  return uuids as string[];
}

async function deleteUserRecords(
  userId: string,
  uuids: string[],
): Promise<number> {
  const db = getDb();

  const deleted = await db
    .delete(records)
    .where(and(eq(records.userId, userId), inArray(records.uuid, uuids)))
    .returning({ uuid: records.uuid });

  return deleted.length;
}

export default defineEventHandler(
  async (event): Promise<DeleteRecordsResponse> => {
    try {
      const userId = requireUser(event);
      const body = (await readBody(event)) as DeleteRecordsBody;

      const uuids = validateUuids(body);
      const deletedCount = await deleteUserRecords(userId, uuids);

      return { meta: { deleted: deletedCount } };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
