CREATE TABLE "sources" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"provider" text,
	"endpoint_slug" text NOT NULL,
	"route_folder" text NOT NULL,
	"field_mapping" jsonb,
	"last_hit_at" timestamp with time zone,
	"record_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sources_endpoint_slug_unique" UNIQUE("endpoint_slug")
);
--> statement-breakpoint
CREATE INDEX "sources_user_id_idx" ON "sources" USING btree ("user_id");