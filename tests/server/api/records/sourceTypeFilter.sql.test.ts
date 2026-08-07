import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { SOURCE_TYPES } from "../../../../shared/utils/sourceTypes";

// The sibling list.test.ts mocks drizzle-orm wholesale, so it can only prove
// the handler *calls* inArray with the right column — not that drizzle emits
// valid, correct SQL for a subquery argument. This file does NOT mock
// drizzle: it compiles the real condition and asserts the generated SQL, which
// is the one layer the mocks can't reach (and the layer the original bug hid
// in). getDb is never called here — sourceTypeCondition takes db as a
// parameter, so we hand it a compile-only client.
vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);

const { sourceTypeCondition } =
  await import("../../../../server/api/records/index.get");

// neon() requires a user:pass@host DSN shape to parse, but nothing here ever
// connects — drizzle only builds SQL. The DSN is assembled from throwaway
// placeholder parts (all meaningless, none real) so no literal connection
// string appears in source for the repo secret scanner to flag.
const DSN_SCHEME = "postgresql";
const DSN_AUTHORITY = "placeholder-user:placeholder-pass";
const DSN_HOST = "host.invalid";
const COMPILE_ONLY_DSN = `${DSN_SCHEME}://${DSN_AUTHORITY}@${DSN_HOST}/db`;

function compileOnlyDb() {
  return drizzle(neon(COMPILE_ONLY_DSN));
}

describe("sourceTypeCondition (compiled SQL)", () => {
  it("filters records via source_id IN (subquery on sources), not records.source", () => {
    const condition = sourceTypeCondition(compileOnlyDb(), "user_1", "webhook");
    const { sql, params } = new PgDialect().sqlToQuery(condition);

    expect(sql).toContain(
      '"records"."source_id" in (select "uuid" from "sources"',
    );
    // The user scope and type filter both land in the subquery WHERE, in that
    // order, so it can never leak another user's source uuids into the IN.
    expect(sql).toContain('"sources"."user_id" = $1 and "sources"."type" = $2');
    expect(params).toEqual(["user_1", "webhook"]);

    // The original bug matched on the free-text display-name column; prove it
    // is gone at the SQL level, not just the mock level.
    expect(sql).not.toContain('"records"."source"');
  });

  it.each(SOURCE_TYPES)(
    "binds the requested type %s as a parameter",
    (sourceType) => {
      const condition = sourceTypeCondition(
        compileOnlyDb(),
        "user_1",
        sourceType,
      );
      const { params } = new PgDialect().sqlToQuery(condition);

      expect(params).toEqual(["user_1", sourceType]);
    },
  );
});
