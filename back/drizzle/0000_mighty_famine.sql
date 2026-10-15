CREATE TABLE "layout_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"layout_id" uuid,
	"kind" text DEFAULT 'photo' NOT NULL,
	"url" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layout_media_parent_required" CHECK ("layout_media"."store_id" IS NOT NULL OR "layout_media"."layout_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "layout_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layout_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"x_cm" integer DEFAULT 0 NOT NULL,
	"y_cm" integer DEFAULT 0 NOT NULL,
	"width_cm" integer NOT NULL,
	"depth_cm" integer NOT NULL,
	"height_cm" integer NOT NULL,
	"rotation_deg" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layout_objects_width_cm_positive" CHECK ("layout_objects"."width_cm" > 0),
	CONSTRAINT "layout_objects_depth_cm_positive" CHECK ("layout_objects"."depth_cm" > 0),
	CONSTRAINT "layout_objects_height_cm_positive" CHECK ("layout_objects"."height_cm" > 0)
);
--> statement-breakpoint
CREATE TABLE "layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"width_cm" integer NOT NULL,
	"depth_cm" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layouts_width_cm_positive" CHECK ("layouts"."width_cm" > 0),
	CONSTRAINT "layouts_depth_cm_positive" CHECK ("layouts"."depth_cm" > 0)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "layout_media" ADD CONSTRAINT "layout_media_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_media" ADD CONSTRAINT "layout_media_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_objects" ADD CONSTRAINT "layout_objects_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;