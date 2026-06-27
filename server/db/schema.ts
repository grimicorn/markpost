import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
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
