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

// Bounds for the opt-in `expiresInDays` mint attribute. Omitting the
// attribute entirely (undefined) skips this check and mints a
// never-expiring token — these bounds only constrain an explicit choice.
const MIN_TOKEN_EXPIRY_DAYS = 1;
const MAX_TOKEN_EXPIRY_DAYS = 3650; // 10 years — a ceiling against fat-fingered values, not a policy.

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

async function insertToken(
  db: ReturnType<typeof getDb>,
  userId: string,
  name: string,
  rawToken: string,
  expiresAt: Date | null,
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

      assertValidExpiresInDays(attributes.expiresInDays);

      const rawToken = generateRawToken();
      const expiresAt = computeExpiresAt(attributes.expiresInDays);
      const record = await insertToken(
        getDb(),
        userId,
        attributes.name,
        rawToken,
        expiresAt,
      );

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
