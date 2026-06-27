CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"vault_dir" text DEFAULT '~/Documents/Vault' NOT NULL,
	"filename_template" text DEFAULT '{{date}}-{{slug}}.md' NOT NULL,
	"auto_sync" boolean DEFAULT true NOT NULL,
	"auto_delete" boolean DEFAULT true NOT NULL,
	"frontmatter" boolean DEFAULT true NOT NULL,
	"conflict_strategy" text DEFAULT 'suffix' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"accent_color" text DEFAULT '#a855f7' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
