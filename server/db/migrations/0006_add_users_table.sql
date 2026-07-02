CREATE TABLE "users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "users" ("user_id")
SELECT "user_id" FROM "api_tokens"
UNION
SELECT "user_id" FROM "sources"
UNION
SELECT "user_id" FROM "records"
UNION
SELECT "user_id" FROM "events"
UNION
SELECT "user_id" FROM "user_settings"
ON CONFLICT ("user_id") DO NOTHING;
