import { eq, sql } from "drizzle-orm";
import type { H3Event } from "h3";
import { getDb } from "../../db";
import { records, sources, userSettings } from "../../db/schema";
import { apiErrorHandler, ApiError } from "../../utils/errors";
import { applyFieldMapping } from "../../utils/fieldMapper";
import { parseWebhookPayload, type UserSettings } from "../../utils/markdown";
import { verifyProviderSignature } from "../../utils/signatureVerifier";
import { writeEvent } from "../../utils/eventWriter";

const DEFAULT_FILENAME_TEMPLATE = "{{date}}-{{slug}}.md";
const STRIPE_WEBHOOK_SECRET_ENV = "STRIPE_WEBHOOK_SECRET";

type SourceRow = {
  uuid: string;
  userId: string;
  type: string;
  name: string;
  provider: string | null;
  fieldMapping: unknown;
};

type UserSettingsRow = {
  filenameTemplate: string;
};

function notFoundError(): ApiError {
  return new ApiError(
    [
      {
        status: "404",
        title: "Not Found",
        detail: "No source was found for the given slug.",
      },
    ],
    404,
  );
}

function signatureError(reason: string): ApiError {
  return new ApiError(
    [
      {
        status: "401",
        title: "Unauthorized",
        detail: reason,
      },
    ],
    401,
  );
}

async function resolveSourceBySlug(slug: string): Promise<SourceRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      uuid: sources.uuid,
      userId: sources.userId,
      type: sources.type,
      name: sources.name,
      provider: sources.provider,
      fieldMapping: sources.fieldMapping,
    })
    .from(sources)
    .where(eq(sources.endpointSlug, slug))
    .limit(1);

  return row ?? null;
}

async function fetchUserSettings(userId: string): Promise<UserSettingsRow> {
  const db = getDb();
  const [row] = await db
    .select({ filenameTemplate: userSettings.filenameTemplate })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return {
    filenameTemplate: row?.filenameTemplate ?? DEFAULT_FILENAME_TEMPLATE,
  };
}

type ParsedWebhookResult = {
  title: string;
  body: string;
  tags: string[];
  frontmatter: unknown;
  filePath: string;
};

async function insertWebhookRecord(
  source: SourceRow,
  parsed: ParsedWebhookResult,
) {
  const db = getDb();
  const [created] = await db
    .insert(records)
    .values({
      userId: source.userId,
      title: parsed.title,
      content: parsed.body,
      sourceId: source.uuid,
      source: source.name,
      status: "pending",
      tags: parsed.tags,
      frontmatter: parsed.frontmatter,
      filePath: parsed.filePath,
    })
    .returning();

  if (!created) {
    throw new ApiError(
      [
        {
          status: "500",
          title: "Internal Server Error",
          detail: "Failed to insert record",
        },
      ],
      500,
    );
  }

  return created;
}

async function updateSourceStats(sourceId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sources)
    .set({
      lastHitAt: new Date(),
      recordCount: sql`${sources.recordCount} + 1`,
    })
    .where(eq(sources.uuid, sourceId));
}

function buildProviderHeaders(
  event: H3Event,
): Record<string, string | undefined> {
  return {
    "stripe-signature": getHeader(event, "stripe-signature") ?? undefined,
  };
}

export default defineEventHandler(async (event) => {
  try {
    const slug = getRouterParam(event, "slug");

    if (!slug) {
      throw notFoundError();
    }

    const source = await resolveSourceBySlug(slug);

    if (!source) {
      throw notFoundError();
    }

    const rawBodyText = await readRawBody(event);
    const rawBody = rawBodyText ?? "";

    const providerHeaders = buildProviderHeaders(event);
    const stripeSecret = process.env[STRIPE_WEBHOOK_SECRET_ENV] ?? null;

    const sigResult = verifyProviderSignature({
      provider: source.provider,
      headers: providerHeaders,
      rawBody,
      secret: stripeSecret,
    });

    if (!sigResult.ok) {
      throw signatureError(sigResult.reason);
    }

    let payload: Record<string, unknown> = {};

    try {
      const parsedBody: unknown = rawBody ? JSON.parse(rawBody) : {};

      if (
        parsedBody !== null &&
        typeof parsedBody === "object" &&
        !Array.isArray(parsedBody)
      ) {
        payload = parsedBody as Record<string, unknown>;
      }
    } catch {
      // Non-JSON body: treat as empty payload; the parser will use defaults
    }

    const webhookPayload = applyFieldMapping(
      payload,
      source.fieldMapping,
      source.name,
    );

    const settingsRow = await fetchUserSettings(source.userId);
    const userSettingsValues: UserSettings = {
      filenameTemplate: settingsRow.filenameTemplate,
    };

    const parsed = parseWebhookPayload(webhookPayload, userSettingsValues);

    const record = await insertWebhookRecord(source, parsed);

    // Stats and event writes are best-effort: failures do not roll back the record
    // or change the 202 response, preventing cascading failures on a single ingest.
    await updateSourceStats(source.uuid).catch((updateError) => {
      console.error(
        "[hooks/ingest] failed to update source stats:",
        updateError,
      );
    });

    await writeEvent({
      userId: source.userId,
      kind: "ok",
      message: `Webhook received: ${record.title}`,
      recordUuid: record.uuid,
      sourceId: source.uuid,
    }).catch((writeError) => {
      console.error("[hooks/ingest] failed to write event:", writeError);
    });

    setResponseStatus(event, 202);
    return { data: { uuid: record.uuid } };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
