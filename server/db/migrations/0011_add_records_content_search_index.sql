CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_title_trgm_idx" ON "records" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_content_trgm_idx" ON "records" USING gin ("content" gin_trgm_ops);
