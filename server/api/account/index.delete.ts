import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { records, sources, userSettings } from "../../db/schema";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";

async function deleteAllUserData(userId: string): Promise<void> {
  const database = getDb();
  await database.transaction(async (transaction) => {
    await transaction.delete(records).where(eq(records.userId, userId));
    await transaction.delete(sources).where(eq(sources.userId, userId));
    await transaction
      .delete(userSettings)
      .where(eq(userSettings.userId, userId));
  });
}

export default defineEventHandler(
  async (event): Promise<{ meta: { deleted: true } }> => {
    try {
      const userId = requireUser(event);
      await deleteAllUserData(userId);
      return { meta: { deleted: true } };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);
