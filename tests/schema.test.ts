import { describe, expect, it } from "vitest";
import { records, sources } from "../server/db/schema";

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
