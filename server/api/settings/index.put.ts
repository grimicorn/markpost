import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { userSettings } from "../../db/schema";
import type { ApiRequest } from "../../types/api.types";
import { requireUser } from "../../utils/auth";
import { apiErrorHandler } from "../../utils/errors";
import {
  CONFLICT_STRATEGIES,
  THEMES,
  userSettingsSerializer,
  type UserSettingsApiResponse,
} from "../../utils/response";
import { apiValidate, type AttributeRule } from "../../utils/validate";

type UpdateSettingsAttributes = {
  vaultDir?: string;
  filenameTemplate?: string;
  autoSync?: boolean;
  autoDelete?: boolean;
  frontmatter?: boolean;
  conflictStrategy?: string;
  theme?: string;
  accentColor?: string;
};

type UpdateSettingsBody = {
  data?: {
    type?: string;
    attributes?: UpdateSettingsAttributes;
  };
};

const VALIDATION_RULES: AttributeRule[] = [
  { key: "vaultDir", type: "string", optional: true },
  { key: "filenameTemplate", type: "string", optional: true },
  { key: "autoSync", type: "boolean", optional: true },
  { key: "autoDelete", type: "boolean", optional: true },
  { key: "frontmatter", type: "boolean", optional: true },
  {
    key: "conflictStrategy",
    type: "string",
    optional: true,
    enum: CONFLICT_STRATEGIES,
  },
  { key: "theme", type: "string", optional: true, enum: THEMES },
  { key: "accentColor", type: "string", optional: true },
];

type Database = ReturnType<typeof getDb>;

async function upsertUserSettings(
  database: Database,
  userId: string,
  attributes: UpdateSettingsAttributes,
) {
  const [updated] = await database
    .insert(userSettings)
    .values({ userId, ...attributes })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...attributes, updatedAt: new Date() },
    })
    .returning();

  return updated;
}

export default defineEventHandler(
  async (event): Promise<UserSettingsApiResponse> => {
    try {
      const userId = requireUser(event);
      const body = (await readBody(event)) as UpdateSettingsBody;

      apiValidate(body as ApiRequest, VALIDATION_RULES);

      const attributes =
        (body.data?.attributes as UpdateSettingsAttributes) ?? {};
      const settings = await upsertUserSettings(getDb(), userId, attributes);

      return { data: userSettingsSerializer(settings) };
    } catch (error) {
      return apiErrorHandler(error);
    }
  },
);

export { upsertUserSettings };
