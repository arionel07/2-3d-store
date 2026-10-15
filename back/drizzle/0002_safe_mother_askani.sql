CREATE TABLE "layout_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layout_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"width_cm" integer NOT NULL,
	"depth_cm" integer NOT NULL,
	"objects" jsonb NOT NULL,
	"author_id" text NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "layout_versions" ADD CONSTRAINT "layout_versions_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_versions" ADD CONSTRAINT "layout_versions_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "layout_versions_layout_version_uidx" ON "layout_versions" USING btree ("layout_id","version");--> statement-breakpoint
CREATE INDEX "layout_versions_layout_id_idx" ON "layout_versions" USING btree ("layout_id");