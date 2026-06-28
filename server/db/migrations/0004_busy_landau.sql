ALTER TABLE "records" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "file_path" text;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "frontmatter" jsonb;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_source_id_sources_uuid_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "records_status_idx" ON "records" USING btree ("status");