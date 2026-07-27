import { getDb } from "../../db";
import { apiTokens } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { ApiError, apiErrorHandler } from "../../utils/errors";
import type { ApiResponse } from "../../types/api.types";
import { apiValidate, type AttributeRule } from "../../utils/validate";
import {
  computeExpiresAt,
  extractTokenPrefix,
  generateRawToken,
  hashToken,
} from "../../utils/tokens";
import {
  MAX_TOKEN_EXPIRY_DAYS,
  MIN_TOKEN_EXPIRY_DAYS,
} from "#shared/utils/tokens";

type MintTokenAttributes = {
  name?: string;
  expiresInDays?: number;
};

type MintTokenBody = {
  data?: {
    type?: string;
    attributes?: MintTokenAttributes;
  };
};

type MintedTokenResource = {
  type: "api_tokens";
  id: string;
  attributes: {
    name: string;
    prefix: string;
    createdAt: Date;
    expiresAt: Date | null;
    token: string;
  };
};

type MintTokenApiResponse = ApiResponse<MintedTokenResource>;

const VALIDATION_RULES: AttributeRule[] = [
  { key: "name", type: "string" },
  { key: "expiresInDays", type: "number", optional: true },
];

function invalidExpiryError(): ApiError {
  return new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail: `ExpiresInDays must be a whole number between ${MIN_TOKEN_EXPIRY_DAYS} and ${MAX_TOKEN_EXPIRY_DAYS}`,
        source: { pointer: "/data/attributes/expiresInDays" },
      },
    ],
    422,
  );
}

// Only undefined/null mean "no expiry requested" (a JSON:API client sending
// an explicit `"expiresInDays": null` means the same thing as leaving it out
// entirely). Anything else that isn't a number — including "" — is a bad
// value, not an absent one: apiValidate's presence check (isAbsent) treats
// "" as absent for an *optional* rule and skips the type check, so without
// this explicit rejection an empty-string form field would silently mint a
// never-expiring token instead of failing with a 422.
function normalizeExpiresInDays(expiresInDays: unknown): number | undefined {
  if (expiresInDays === undefined || expiresInDays === null) {
    return undefined;
  }

  if (typeof expiresInDays !== "number") {
    throw invalidExpiryError();
  }

  return expiresInDays;
}

function assertValidExpiresInDays(expiresInDays: number | undefined): void {
  if (expiresInDays === undefined) {
    return;
  }

  const isWithinBounds =
    Number.isInteger(expiresInDays) &&
    expiresInDays >= MIN_TOKEN_EXPIRY_DAYS &&
    expiresInDays <= MAX_TOKEN_EXPIRY_DAYS;

  if (!isWithinBounds) {
    throw invalidExpiryError();
  }
}

type InsertTokenInput = {
  userId: string;
  name: string;
  rawToken: string;
  expiresAt: Date | null;
};

async function insertToken(
  db: ReturnType<typeof getDb>,
  { userId, name, rawToken, expiresAt }: InsertTokenInput,
) {
  const prefix = extractTokenPrefix(rawToken);
  const hashedToken = hashToken(rawToken);

  const [created] = await db
    .insert(apiTokens)
    .values({ userId, name, prefix, hashedToken, expiresAt })
    .returning();

  return created;
}

export default defineEventHandler(
  async (event): Promise<MintTokenApiResponse> => {
    try {
      const userId = requireUser(event);
      const body = ((await readBody(event)) ?? {}) as MintTokenBody;

      apiValidate(body as ApiRequest, VALIDATION_RULES);

      const attributes = (body.data?.attributes ?? {}) as Required<
        Pick<MintTokenAttributes, "name">
      > &
        Pick<MintTokenAttributes, "expiresInDays">;

      const expiresInDays = normalizeExpiresInDays(attributes.expiresInDays);
      assertValidExpiresInDays(expiresInDays);

      const rawToken = generateRawToken();
      const expiresAt = computeExpiresAt(expiresInDays);
      const record = await insertToken(getDb(), {
        userId,
        name: attributes.name,
        rawToken,
        expiresAt,
      });

      setResponseStatus(event, 201);

      return {
        data: {
          type: "api_tokens",
          id: record.id,
          attributes: {
            name: record.name,
            prefix: record.prefix,
            createdAt: record.createdAt,
            expiresAt: record.expiresAt,
            token: rawToken,
          },
        },
      };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
