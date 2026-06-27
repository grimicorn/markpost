import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

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

export const RECORD_STATUSES = ["synced", "pending", "error"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

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
    sourceId: uuid("source_id").references(() => sources.uuid),
    source: text("source"),
    status: text("status").notNull().default("pending"),
    filePath: text("file_path"),
    tags: jsonb("tags"),
    frontmatter: jsonb("frontmatter"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("records_user_id_idx").on(table.userId),
    index("records_status_idx").on(table.status),
  ],
);

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  vaultDir: text("vault_dir").notNull().default("~/Documents/Vault"),
  filenameTemplate: text("filename_template")
    .notNull()
    .default("{{date}}-{{slug}}.md"),
  autoSync: boolean("auto_sync").notNull().default(true),
  autoDelete: boolean("auto_delete").notNull().default(true),
  frontmatter: boolean("frontmatter").notNull().default(true),
  conflictStrategy: text("conflict_strategy").notNull().default("suffix"),
  theme: text("theme").notNull().default("system"),
  accentColor: text("accent_color").notNull().default("#a855f7"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
