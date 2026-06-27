import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { sources } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import { isValidUuid } from "../../utils/uuid";

type DeleteSourceResponse = {
  meta: { deleted: number };
};

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
        detail: "No source was found for the given uuid.",
      },
    ],
    404,
  );
}

async function deleteUserSource(
  userId: string,
  sourceUuid: string,
): Promise<number> {
  const db = getDb();

  const deleted = await db
    .delete(sources)
    .where(and(eq(sources.userId, userId), eq(sources.uuid, sourceUuid)))
    .returning({ uuid: sources.uuid });

  return deleted.length;
}

export default defineEventHandler(
  async (event): Promise<DeleteSourceResponse> => {
    try {
      const userId = requireUser(event);
      const sourceUuid = getRouterParam(event, "uuid");

      if (!isValidUuid(sourceUuid)) {
        throw invalidUuidError();
      }

      const deletedCount = await deleteUserSource(userId, sourceUuid);

      if (deletedCount === 0) {
        throw notFoundError();
      }

      return { meta: { deleted: deletedCount } };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
