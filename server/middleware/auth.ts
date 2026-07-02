import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { apiTokens } from "../db/schema";
import { hashToken, isApiToken } from "../utils/tokens";
import { ensureUserRegistered } from "../utils/auth";
import { getClerkClient } from "../utils/clerk";

const BEARER_PREFIX = /^Bearer\s+/i;

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
const BILLING_WEBHOOK_PATH = "/api/billing/webhook";

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) {
    return;
  }

  if (event.path.startsWith(HOOKS_PATH_PREFIX)) {
    return;
  }

  if (event.path === BILLING_WEBHOOK_PATH) {
    return;
  }

  const rawToken = getHeader(event, "authorization")?.replace(
    BEARER_PREFIX,
    "",
  );
  if (!rawToken) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const viaApiToken = isApiToken(rawToken);
  const userId = viaApiToken
    ? await authenticateViaApiToken(rawToken)
    : await authenticateViaClerk(rawToken);

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // Only the Clerk path can carry a brand-new identity; an API token can only
  // exist for an already-registered user. Runs outside authenticateViaClerk's
  // try/catch so a disabled-signups 403 is not swallowed into a 401.
  if (!viaApiToken) {
    await ensureUserRegistered(userId);
  }

  event.context.userId = userId;
});
