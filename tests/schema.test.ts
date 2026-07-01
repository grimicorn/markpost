import { describe, expect, it } from "vitest";
import { events, records, sources } from "../server/db/schema";

describe("records schema", () => {
  it("includes a userId column", () => {
    expect(records.userId).toBeDefined();
  });

  it("userId column is not nullable", () => {
    expect(records.userId.notNull).toBe(true);
  });

  it("userId column maps to user_id in the database", () => {
    expect(records.userId.name).toBe("user_id");
  });

  it("includes a nullable sourceId column mapped to source_id", () => {
    expect(records.sourceId).toBeDefined();
    expect(records.sourceId.name).toBe("source_id");
    expect(records.sourceId.notNull).toBe(false);
  });

  it("includes a nullable source column", () => {
    expect(records.source).toBeDefined();
    expect(records.source.notNull).toBe(false);
  });

  it("status column defaults to pending and is not nullable", () => {
    expect(records.status).toBeDefined();
    expect(records.status.notNull).toBe(true);
    expect(records.status.default).toBe("pending");
  });

  it("includes a nullable filePath column mapped to file_path", () => {
    expect(records.filePath).toBeDefined();
    expect(records.filePath.name).toBe("file_path");
    expect(records.filePath.notNull).toBe(false);
  });

  it("includes a nullable tags jsonb column", () => {
    expect(records.tags).toBeDefined();
    expect(records.tags.columnType).toBe("PgJsonb");
  });

  it("includes a nullable frontmatter jsonb column", () => {
    expect(records.frontmatter).toBeDefined();
    expect(records.frontmatter.columnType).toBe("PgJsonb");
  });

  it("includes a nullable syncedAt timestamp column mapped to synced_at", () => {
    expect(records.syncedAt).toBeDefined();
    expect(records.syncedAt.name).toBe("synced_at");
    expect(records.syncedAt.notNull).toBe(false);
  });

  it("includes a nullable errorMessage column mapped to error_message", () => {
    expect(records.errorMessage).toBeDefined();
    expect(records.errorMessage.name).toBe("error_message");
    expect(records.errorMessage.notNull).toBe(false);
  });
});

describe("sources schema", () => {
  it("includes a uuid primary key column", () => {
    expect(sources.uuid).toBeDefined();
  });

  it("includes a userId column mapped to user_id", () => {
    expect(sources.userId.name).toBe("user_id");
  });

  it("userId column is not nullable", () => {
    expect(sources.userId.notNull).toBe(true);
  });

  it("includes an endpointSlug column mapped to endpoint_slug", () => {
    expect(sources.endpointSlug.name).toBe("endpoint_slug");
  });

  it("includes a routeFolder column mapped to route_folder", () => {
    expect(sources.routeFolder.name).toBe("route_folder");
  });

  it("includes a nullable provider column", () => {
    expect(sources.provider).toBeDefined();
    expect(sources.provider.notNull).toBe(false);
  });

  it("includes a nullable fieldMapping column mapped to field_mapping", () => {
    expect(sources.fieldMapping.name).toBe("field_mapping");
  });

  it("includes a nullable lastHitAt column mapped to last_hit_at", () => {
    expect(sources.lastHitAt.name).toBe("last_hit_at");
  });

  it("recordCount defaults to 0", () => {
    expect(sources.recordCount.default).toBe(0);
  });
});

describe("events schema", () => {
  it("includes an id uuid primary key column", () => {
    expect(events.id).toBeDefined();
  });

  it("includes a userId column mapped to user_id", () => {
    expect(events.userId.name).toBe("user_id");
  });

  it("userId column is not nullable", () => {
    expect(events.userId.notNull).toBe(true);
  });

  it("includes a ts timestamp column with default now", () => {
    expect(events.ts).toBeDefined();
    expect(events.ts.notNull).toBe(true);
  });

  it("includes a kind column that is not nullable", () => {
    expect(events.kind).toBeDefined();
    expect(events.kind.notNull).toBe(true);
  });

  it("includes a message column that is not nullable", () => {
    expect(events.message).toBeDefined();
    expect(events.message.notNull).toBe(true);
  });

  it("includes a nullable recordUuid column mapped to record_uuid", () => {
    expect(events.recordUuid).toBeDefined();
    expect(events.recordUuid.name).toBe("record_uuid");
    expect(events.recordUuid.notNull).toBe(false);
  });

  it("includes a nullable sourceId column mapped to source_id", () => {
    expect(events.sourceId).toBeDefined();
    expect(events.sourceId.name).toBe("source_id");
    expect(events.sourceId.notNull).toBe(false);
  });
});
