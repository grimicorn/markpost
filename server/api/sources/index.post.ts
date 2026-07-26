import { getDb } from "../../db";
import { sources } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import { generateEndpointSlug } from "../../utils/endpointSlug";
import { assertWithinSourceLimit } from "../../utils/planLimits";
import {
  generateProviderSecret,
  hashSharedSecret,
  isHashedStorageProvider,
  isKnownProvider,
  isManualSecretProvider,
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
  // Only used for manual-secret providers (Stripe): Stripe issues the signing
  // secret when the user creates their own webhook endpoint, so we can't
  // generate it — the user pastes it in here instead.
  providerSecret?: string;
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

// What to persist for a source's provider secret vs. what to hand back to the
// caller once. For hashed-storage providers (Zapier/Shortcuts) these differ:
// only the hash is ever stored, but the plaintext must still be revealed once
// so the user can paste it into that provider's own webhook configuration.
type ProviderSecretPlan = {
  storedSecret: string | null;
  revealSecret: string | null;
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

function invalidProviderSecretError(): ApiError {
  return new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail: "ProviderSecret must be a string",
        source: { pointer: "/data/attributes/providerSecret" },
      },
    ],
    422,
  );
}

function missingProviderSecretError(provider: string): ApiError {
  return new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail: `providerSecret is required for provider "${provider}" — it is issued by ${provider}, not generated by markpost.`,
        source: { pointer: "/data/attributes/providerSecret" },
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

  const normalizedProvider = normalizeProvider(attributes.provider);
  if (normalizedProvider && !isKnownProvider(normalizedProvider)) {
    throw unknownProviderError();
  }

  if (
    attributes.providerSecret !== undefined &&
    typeof attributes.providerSecret !== "string"
  ) {
    throw invalidProviderSecretError();
  }
}

// Manual-secret providers (Stripe) issue their own secret; the caller must
// supply it, or the source would be created "verified" with nothing to
// verify against and 401 every real delivery forever.
function validateProviderSecretPresenceOrThrow(
  provider: string | null,
  providerSecret: string | undefined,
): void {
  if (!provider || !isManualSecretProvider(provider)) {
    return;
  }

  if (!providerSecret?.trim()) {
    throw missingProviderSecretError(provider);
  }
}

function computeProviderSecretPlan(
  provider: string | null,
  suppliedSecret: string | undefined,
): ProviderSecretPlan {
  if (provider && isManualSecretProvider(provider)) {
    const trimmed = suppliedSecret?.trim() ?? null;
    return { storedSecret: trimmed, revealSecret: trimmed };
  }

  if (provider && isSecretBackedProvider(provider)) {
    const plaintext = generateProviderSecret();
    const storedSecret = isHashedStorageProvider(provider)
      ? hashSharedSecret(plaintext)
      : plaintext;
    return { storedSecret, revealSecret: plaintext };
  }

  return { storedSecret: null, revealSecret: null };
}

function buildInsertInput(
  attributes: Required<CreateSourceAttributes>,
  provider: string | null,
  storedSecret: string | null,
): InsertSourceInput {
  return {
    type: attributes.type,
    name: attributes.name,
    routeFolder: attributes.routeFolder,
    provider: provider ?? undefined,
    providerSecret: storedSecret,
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

    const provider = deriveProvider(attributes);
    validateProviderSecretPresenceOrThrow(provider, attributes.providerSecret);

    await assertWithinSourceLimit(userId);

    const { storedSecret, revealSecret } = computeProviderSecretPlan(
      provider,
      attributes.providerSecret,
    );

    const source = await insertSource(
      userId,
      buildInsertInput(attributes, provider, storedSecret),
    );

    setResponseStatus(event, 201);

    return {
      data: sourceSerializer(
        { ...source, providerSecret: revealSecret },
        { revealProviderSecret: true },
      ),
    };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
