import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { sources } from "../db/schema";

// Fixed-window counter, persisted on the `sources` row so it survives across
// Netlify's stateless serverless invocations (no in-memory counter would be
// shared between them). A single atomic UPDATE...RETURNING both advances the
// counter and reads the result in one round-trip, which keeps concurrent hits
// on the same source correct: Postgres serializes concurrent UPDATEs to the
// same row, so two simultaneous requests cannot both read-then-write a stale
// count. The tradeoff is a fixed window (not sliding/leaky-bucket) and one
// extra write per webhook hit; a fixed window is a reasonable UX/complexity
// fit for "stop a flood", not a precise rate contract.
export const WEBHOOK_THROTTLE_WINDOW_SECONDS = 60;
export const WEBHOOK_THROTTLE_MAX_HITS = 30;

export type ThrottleResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

type ThrottleCounterRow = {
  throttleCount: number;
  throttleWindowStart: Date;
};

async function recordHitAndFetchCounter(
  sourceId: string,
): Promise<ThrottleCounterRow | null> {
  const database = getDb();
  const windowExpired = sql`(now() - ${sources.throttleWindowStart}) >= (${WEBHOOK_THROTTLE_WINDOW_SECONDS} * interval '1 second')`;

  const [row] = await database
    .update(sources)
    .set({
      throttleWindowStart: sql`CASE WHEN ${windowExpired} THEN now() ELSE ${sources.throttleWindowStart} END`,
      throttleCount: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${sources.throttleCount} + 1 END`,
    })
    .where(eq(sources.uuid, sourceId))
    .returning({
      throttleCount: sources.throttleCount,
      throttleWindowStart: sources.throttleWindowStart,
    });

  return row ?? null;
}

function secondsRemainingInWindow(windowStart: Date): number {
  const elapsedSeconds = (Date.now() - windowStart.getTime()) / 1000;
  const remainingSeconds = WEBHOOK_THROTTLE_WINDOW_SECONDS - elapsedSeconds;
  return Math.max(1, Math.ceil(remainingSeconds));
}

// Records this hit against the source's fixed window and reports whether it
// is within the allowed rate. Isolated from the route handler so it can be
// unit-tested against a mocked db and swapped independently of the ingest
// logic it protects.
export async function recordWebhookHit(
  sourceId: string,
): Promise<ThrottleResult> {
  const counter = await recordHitAndFetchCounter(sourceId);

  if (!counter) {
    // The source row vanished between resolution and this check (e.g.
    // deleted concurrently); let the caller's existing not-found handling
    // take over rather than throttling a request with nothing to throttle.
    return { allowed: true };
  }

  if (counter.throttleCount > WEBHOOK_THROTTLE_MAX_HITS) {
    return {
      allowed: false,
      retryAfterSeconds: secondsRemainingInWindow(counter.throttleWindowStart),
    };
  }

  return { allowed: true };
}
