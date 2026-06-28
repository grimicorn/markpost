import { getDb } from "../../db";
import { apiTokens } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";
import type { ApiResponse } from "../../types/api.types";
import { apiValidate, type AttributeRule } from "../../utils/validate";
import {
  extractTokenPrefix,
  generateRawToken,
  hashToken,
} from "../../utils/tokens";

type MintTokenAttributes = {
  name?: string;
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
    token: string;
  };
};

type MintTokenApiResponse = ApiResponse<MintedTokenResource>;

const VALIDATION_RULES: AttributeRule[] = [{ key: "name", type: "string" }];

async function insertToken(
  db: ReturnType<typeof getDb>,
  userId: string,
  name: string,
  rawToken: string,
) {
  const prefix = extractTokenPrefix(rawToken);
  const hashedToken = hashToken(rawToken);

  const [created] = await db
    .insert(apiTokens)
    .values({ userId, name, prefix, hashedToken })
    .returning();

  return created;
}

export default defineEventHandler(
  async (event): Promise<MintTokenApiResponse> => {
    try {
      const userId = requireUser(event);
      const body = ((await readBody(event)) ?? {}) as MintTokenBody;

      apiValidate(body as ApiRequest, VALIDATION_RULES);

      const name = (body.data?.attributes as Required<MintTokenAttributes>)
        .name;
      const rawToken = generateRawToken();
      const record = await insertToken(getDb(), userId, name, rawToken);

      setResponseStatus(event, 201);

      return {
        data: {
          type: "api_tokens",
          id: record.id,
          attributes: {
            name: record.name,
            prefix: record.prefix,
            createdAt: record.createdAt,
            token: rawToken,
          },
        },
      };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
