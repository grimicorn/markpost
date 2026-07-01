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
const RECORD_STATUS_PENDING = "pending";
const EVENT_KIND_OK = "ok";

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
      status: RECORD_STATUS_PENDING,
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

function parseBodyToPayload(rawBody: string): Record<string, unknown> {
  if (!rawBody) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(rawBody);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    // Non-JSON body: treat as empty payload; the parser will use defaults
    return {};
  }
}

async function resolveAndValidateSource(
  slug: string | undefined,
): Promise<SourceRow> {
  if (!slug) {
    throw notFoundError();
  }

  const source = await resolveSourceBySlug(slug);

  if (!source) {
    throw notFoundError();
  }

  return source;
}

function checkSignature(
  source: SourceRow,
  providerHeaders: Record<string, string | undefined>,
  rawBody: string,
): void {
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
}

async function buildAndInsertRecord(source: SourceRow, rawBody: string) {
  const payload = parseBodyToPayload(rawBody);
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
  return insertWebhookRecord(source, parsed);
}

async function writeBestEffortSideEffects(
  source: SourceRow,
  record: { uuid: string; title: string },
): Promise<void> {
  // Stats and event writes are independent best-effort operations: run concurrently
  // so failures in one do not delay the other, and neither rolls back the record
  // or changes the 202 response, preventing cascading failures on a single ingest.
  await Promise.allSettled([
    updateSourceStats(source.uuid).catch((updateError) => {
      console.error(
        "[hooks/ingest] failed to update source stats:",
        updateError,
      );
    }),
    writeEvent({
      userId: source.userId,
      kind: EVENT_KIND_OK,
      message: `Webhook received: ${record.title}`,
      recordUuid: record.uuid,
      sourceId: source.uuid,
    }).catch((writeError) => {
      console.error("[hooks/ingest] failed to write event:", writeError);
    }),
  ]);
}

export default defineEventHandler(async (event) => {
  try {
    const slug = getRouterParam(event, "slug");
    const source = await resolveAndValidateSource(slug);

    const rawBodyText = await readRawBody(event);
    const rawBody = rawBodyText ?? "";

    const providerHeaders = buildProviderHeaders(event);
    checkSignature(source, providerHeaders, rawBody);

    const record = await buildAndInsertRecord(source, rawBody);
    await writeBestEffortSideEffects(source, record);

    setResponseStatus(event, 202);
    return { data: { uuid: record.uuid } };
  } catch (error) {
    return apiErrorHandler(error);
  }
});
