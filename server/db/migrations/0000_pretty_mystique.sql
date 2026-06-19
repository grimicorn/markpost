CREATE TABLE "records" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "records_user_id_idx" ON "records" USING btree ("user_id");
