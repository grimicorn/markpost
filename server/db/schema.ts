import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const records = pgTable(
  "records",
  {
    uuid: uuid("uuid").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
  },
  (table) => [index("records_user_id_idx").on(table.userId)],
);

export const sources = pgTable(
  "sources",
  {
    uuid: uuid("uuid").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    provider: text("provider"),
    endpointSlug: text("endpoint_slug").notNull(),
    routeFolder: text("route_folder").notNull(),
    fieldMapping: jsonb("field_mapping"),
    lastHitAt: timestamp("last_hit_at", { withTimezone: true }),
    recordCount: integer("record_count").default(0).notNull(),
  },
  (table) => [
    index("sources_user_id_idx").on(table.userId),
    unique("sources_endpoint_slug_unique").on(table.endpointSlug),
  ],
);
