import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { apiTokens } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";
import type { ApiResponse } from "../../types/api.types";

type TokenListItem = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

type TokenResource = {
  type: "api_tokens";
  id: string;
  attributes: {
    name: string;
    prefix: string;
    createdAt: Date;
    lastUsedAt: Date | null;
  };
};

type TokenListApiResponse = ApiResponse<TokenResource[]>;

function tokenSerializer(token: TokenListItem): TokenResource {
  return {
    type: "api_tokens",
    id: token.id,
    attributes: {
      name: token.name,
      prefix: token.prefix,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
    },
  };
}

async function listActiveTokens(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<TokenListItem[]> {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(apiTokens.createdAt);
}

export default defineEventHandler(
  async (event): Promise<TokenListApiResponse> => {
    try {
      const userId = requireUser(event);
      const tokens = await listActiveTokens(getDb(), userId);

      return { data: tokens.map(tokenSerializer) };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
