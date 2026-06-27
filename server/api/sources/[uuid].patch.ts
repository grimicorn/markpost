import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { sources } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import { sourceSerializer, type SourceApiResponse } from "../../utils/response";
import { apiValidate, type AttributeRule } from "../../utils/validate";
import { isValidUuid } from "../../utils/uuid";

type PatchSourceAttributes = {
  routeFolder?: string;
  fieldMapping?: unknown;
};

type PatchSourceBody = ApiRequest & {
  data: {
    attributes: PatchSourceAttributes;
  };
};

const VALIDATION_RULES: AttributeRule[] = [
  { key: "routeFolder", type: "string" },
];

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

async function updateUserSource(
  userId: string,
  sourceUuid: string,
  routeFolder: string,
  fieldMapping: unknown,
) {
  const db = getDb();

  const [updated] = await db
    .update(sources)
    .set({ routeFolder, fieldMapping: fieldMapping ?? null })
    .where(and(eq(sources.userId, userId), eq(sources.uuid, sourceUuid)))
    .returning();

  return updated ?? null;
}

export default defineEventHandler(async (event): Promise<SourceApiResponse> => {
  try {
    const userId = requireUser(event);
    const sourceUuid = getRouterParam(event, "uuid");

    if (!isValidUuid(sourceUuid)) {
      throw invalidUuidError();
    }

    const body = (await readBody(event)) as PatchSourceBody;

    apiValidate(body as ApiRequest, VALIDATION_RULES);

    const attributes = body.data.attributes as Required<PatchSourceAttributes>;

    const updated = await updateUserSource(
      userId,
      sourceUuid,
      attributes.routeFolder,
      attributes.fieldMapping,
    );

    if (!updated) {
      throw notFoundError();
    }

    return { data: sourceSerializer(updated) };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
