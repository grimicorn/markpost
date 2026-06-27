import { getDb } from "../../db";
import { sources } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";
import { generateEndpointSlug } from "../../utils/endpointSlug";
import { sourceSerializer, type SourceApiResponse } from "../../utils/response";
import { apiValidate, type AttributeRule } from "../../utils/validate";

const VALID_SOURCE_TYPES = [
  "webhook",
  "email",
  "stripe",
  "github",
  "zapier",
  "rss",
  "shortcuts",
] as const;

type SourceType = (typeof VALID_SOURCE_TYPES)[number];

type CreateSourceAttributes = {
  type?: string;
  name?: string;
  provider?: string;
  routeFolder?: string;
  fieldMapping?: unknown;
};

type CreateSourceBody = ApiRequest & {
  data: {
    type?: string;
    attributes: CreateSourceAttributes;
  };
};

const VALIDATION_RULES: AttributeRule[] = [
  { key: "type", type: "string" },
  { key: "name", type: "string" },
  { key: "routeFolder", type: "string" },
];

function isValidSourceType(value: string): value is SourceType {
  return (VALID_SOURCE_TYPES as readonly string[]).includes(value);
}

async function insertSource(
  userId: string,
  attributes: Required<
    Pick<CreateSourceAttributes, "type" | "name" | "routeFolder">
  > &
    Pick<CreateSourceAttributes, "provider" | "fieldMapping">,
) {
  const db = getDb();
  const endpointSlug = generateEndpointSlug(attributes.type);

  const [created] = await db
    .insert(sources)
    .values({
      userId,
      type: attributes.type,
      name: attributes.name,
      provider: attributes.provider ?? null,
      endpointSlug,
      routeFolder: attributes.routeFolder,
      fieldMapping: attributes.fieldMapping ?? null,
    })
    .returning();

  return created;
}

export default defineEventHandler(async (event): Promise<SourceApiResponse> => {
  try {
    const userId = requireUser(event);
    const body = (await readBody(event)) as CreateSourceBody;

    apiValidate(body as ApiRequest, VALIDATION_RULES);

    const attributes = body.data.attributes as Required<CreateSourceAttributes>;

    if (!isValidSourceType(attributes.type)) {
      throw createError({
        statusCode: 422,
        data: {
          errors: [
            {
              status: "422",
              title: "Invalid Attribute",
              detail: `Type must be one of: ${VALID_SOURCE_TYPES.join(", ")}`,
              source: { pointer: "/data/attributes/type" },
            },
          ],
        },
      });
    }

    const source = await insertSource(userId, {
      type: attributes.type,
      name: attributes.name,
      routeFolder: attributes.routeFolder,
      provider: attributes.provider,
      fieldMapping: attributes.fieldMapping,
    });

    setResponseStatus(event, 201);

    return { data: sourceSerializer(source) };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
