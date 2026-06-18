import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const records = pgTable("records", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
});
