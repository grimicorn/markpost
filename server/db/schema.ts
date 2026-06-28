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

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    hashedToken: text("hashed_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("api_tokens_user_id_idx").on(table.userId),
    unique("api_tokens_hashed_token_unique").on(table.hashedToken),
  ],
);

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
