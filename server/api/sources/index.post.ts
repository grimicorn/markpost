import { getDb } from "../../db";
import { sources } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import { generateEndpointSlug } from "../../utils/endpointSlug";
import { assertWithinSourceLimit } from "../../utils/planLimits";
import {
  generateProviderSecret,
  isKnownProvider,
  isSecretBackedProvider,
  KNOWN_PROVIDERS,
  normalizeProvider,
} from "../../utils/signatureVerifier";
import { sourceSerializer, type SourceApiResponse } from "../../utils/response";
import { apiValidate, type AttributeRule } from "../../utils/validate";

// RSS/Atom is intentionally excluded: there is no polling infrastructure
// (scheduler, dedup, fetch cadence) anywhere in the codebase to service an
// "rss" source, so creating one would silently never ingest a single record.
// See https://github.com/grimicorn/markpost/issues/116.
const VALID_SOURCE_TYPES = [
  "webhook",
  "email",
  "stripe",
  "github",
  "zapier",
  "shortcuts",
] as const;

// Types that double as a provider identity: creating a source with one of
// these types implies signature verification against that provider, even
// when the caller doesn't pass `provider` explicitly (this is how the preset
// flow in AddSourceModal.vue creates sources today).
const PROVIDER_TYPES = new Set<string>([
  "stripe",
  "github",
  "zapier",
  "shortcuts",
]);

const MAX_SLUG_ATTEMPTS = 5;

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

type InsertSourceInput = Required<
  Pick<CreateSourceAttributes, "type" | "name" | "routeFolder">
> &
  Pick<CreateSourceAttributes, "provider" | "fieldMapping"> & {
    providerSecret: string | null;
  };

const VALIDATION_RULES: AttributeRule[] = [
  { key: "type", type: "string" },
  { key: "name", type: "string" },
  { key: "routeFolder", type: "string" },
];

function isValidSourceType(value: string): value is SourceType {
  return (VALID_SOURCE_TYPES as readonly string[]).includes(value);
}

// The Add Source modal creates preset sources by sending `type` alone (e.g.
// type: "github"), never `provider` — so without this fallback their
// signature verification silently never activates. An explicit `provider`
// still wins, which keeps the generic "webhook" type able to opt into a
// provider deliberately. Both paths go through normalizeProvider so creation
// and verification (server/utils/signatureVerifier.ts) agree on what
// "GitHub " and "github" mean — otherwise a source can be created
// successfully and then never verify a single delivery.
function deriveProvider(attributes: {
  type: string;
  provider?: string;
}): string | null {
  const explicitProvider = normalizeProvider(attributes.provider);
  if (explicitProvider) {
    return explicitProvider;
  }

  return PROVIDER_TYPES.has(attributes.type) ? attributes.type : null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

async function insertSource(userId: string, attributes: InsertSourceInput) {
  const db = getDb();

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    try {
      const endpointSlug = generateEndpointSlug(attributes.type);

      const [created] = await db
        .insert(sources)
        .values({
          userId,
          type: attributes.type,
          name: attributes.name,
          provider: attributes.provider ?? null,
          providerSecret: attributes.providerSecret,
          endpointSlug,
          routeFolder: attributes.routeFolder,
          fieldMapping: attributes.fieldMapping ?? null,
        })
        .returning();

      return created;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw new ApiError(
    [
      {
        status: "409",
        title: "Conflict",
        detail: "Could not allocate a unique endpoint slug. Please try again.",
      },
    ],
    409,
  );
}

function invalidTypeError(): ApiError {
  return new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail: `Type must be one of: ${VALID_SOURCE_TYPES.join(", ")}`,
        source: { pointer: "/data/attributes/type" },
      },
    ],
    422,
  );
}

function invalidProviderError(): ApiError {
  return new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail: "Provider must be a string",
        source: { pointer: "/data/attributes/provider" },
      },
    ],
    422,
  );
}

function unknownProviderError(): ApiError {
  return new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail: `Provider must be one of: ${KNOWN_PROVIDERS.join(", ")}`,
        source: { pointer: "/data/attributes/provider" },
      },
    ],
    422,
  );
}

function isProviderWrongType(attributes: CreateSourceAttributes): boolean {
  return (
    attributes.provider !== undefined &&
    attributes.provider !== null &&
    typeof attributes.provider !== "string"
  );
}

function validateAttributesOrThrow(
  attributes: Required<CreateSourceAttributes>,
): void {
  if (!isValidSourceType(attributes.type)) {
    throw invalidTypeError();
  }

  if (isProviderWrongType(attributes)) {
    throw invalidProviderError();
  }

  if (
    attributes.provider &&
    !isKnownProvider(normalizeProvider(attributes.provider))
  ) {
    throw unknownProviderError();
  }
}

function buildInsertInput(
  attributes: Required<CreateSourceAttributes>,
): InsertSourceInput {
  const provider = deriveProvider(attributes);
  const providerSecret =
    provider && isSecretBackedProvider(provider)
      ? generateProviderSecret()
      : null;

  return {
    type: attributes.type,
    name: attributes.name,
    routeFolder: attributes.routeFolder,
    provider: provider ?? undefined,
    providerSecret,
    fieldMapping: attributes.fieldMapping,
  };
}

export default defineEventHandler(async (event): Promise<SourceApiResponse> => {
  try {
    const userId = requireUser(event);
    const body = (await readBody(event)) as CreateSourceBody;

    apiValidate(body as ApiRequest, VALIDATION_RULES);

    const attributes = body.data.attributes as Required<CreateSourceAttributes>;
    validateAttributesOrThrow(attributes);

    await assertWithinSourceLimit(userId);

    const source = await insertSource(userId, buildInsertInput(attributes));

    setResponseStatus(event, 201);

    return {
      data: sourceSerializer(source, { revealProviderSecret: true }),
    };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
