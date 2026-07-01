import { createClerkClient } from "@clerk/backend";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { apiTokens } from "../db/schema";
import { hashToken, isApiToken } from "../utils/tokens";

const BEARER_PREFIX = /^Bearer\s+/i;

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient() {
  if (cachedClerkClient) {
    return cachedClerkClient;
  }

  const secretKey = process.env.NUXT_CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("NUXT_CLERK_SECRET_KEY is not set");
  }

  cachedClerkClient = createClerkClient({ secretKey });
  return cachedClerkClient;
}

async function updateLastUsedAt(tokenId: string): Promise<void> {
  try {
    await getDb()
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, tokenId));
  } catch (error) {
    console.error("[auth] failed to update lastUsedAt", error);
  }
}

async function authenticateViaApiToken(
  rawToken: string,
): Promise<string | null> {
  const incomingHash = hashToken(rawToken);

  const [matched] = await getDb()
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(
      and(eq(apiTokens.hashedToken, incomingHash), isNull(apiTokens.revokedAt)),
    )
    .limit(1);

  if (!matched) {
    return null;
  }

  await updateLastUsedAt(matched.id);

  return matched.userId;
}

async function authenticateViaClerk(token: string): Promise<string | null> {
  try {
    const clerkClient = getClerkClient();
    const { sub } = await clerkClient.verifyToken(token);
    return sub;
  } catch {
    return null;
  }
}

const HOOKS_PATH_PREFIX = "/api/hooks/";

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) {
    return;
  }

  if (event.path.startsWith(HOOKS_PATH_PREFIX)) {
    return;
  }

  const rawToken = getHeader(event, "authorization")?.replace(
    BEARER_PREFIX,
    "",
  );
  if (!rawToken) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userId = isApiToken(rawToken)
    ? await authenticateViaApiToken(rawToken)
    : await authenticateViaClerk(rawToken);

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  event.context.userId = userId;
});
