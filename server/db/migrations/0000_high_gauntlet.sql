CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"cost_rule_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"strategy" text NOT NULL,
	"period_from" timestamp with time zone,
	"period_to" timestamp with time zone,
	"source" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"category" text NOT NULL,
	"scope" text NOT NULL,
	"target_id" uuid,
	"name" text NOT NULL,
	"calculation" text NOT NULL,
	"amount_minor" bigint,
	"percentage_bps" integer,
	"fixed_fee_minor" bigint,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"allocation_strategy" text,
	"reference_text" text,
	"notes" text,
	CONSTRAINT "cost_rules_scoped_id" UNIQUE("organization_id","store_id","id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_name" text,
	"email" text,
	"phone" text,
	"status" text NOT NULL,
	CONSTRAINT "customers_scoped_id" UNIQUE("organization_id","store_id","id")
);
--> statement-breakpoint
CREATE TABLE "inventory_facts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"current_stock" integer,
	"available_stock" integer,
	"reserved_stock" integer,
	"inbound_stock" integer,
	"status" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"title" text NOT NULL,
	"quantity" integer NOT NULL,
	"returned_quantity" integer NOT NULL,
	"unit_gross_minor" bigint NOT NULL,
	"discount_minor" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_id" uuid,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"merchandise_gross_minor" bigint NOT NULL,
	"discounts_minor" bigint NOT NULL,
	"tax_minor" bigint,
	"shipping_charged_minor" bigint NOT NULL,
	"refunded_minor" bigint NOT NULL,
	"revenue_basis" text NOT NULL,
	"ordered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "orders_scoped_id" UNIQUE("organization_id","store_id","id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_currency" text NOT NULL,
	"data_mode" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"credential_reference" text,
	"last_sync_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "products_scoped_id" UNIQUE("organization_id","store_id","id")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text NOT NULL,
	"attempt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_subject" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "variants_scoped_id" UNIQUE("organization_id","store_id","id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"status" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_organization_id_store_id_cost_rule_id_cost_rules_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","cost_rule_id") REFERENCES "public"."cost_rules"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_organization_id_store_id_order_id_commerce_orders_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","order_id") REFERENCES "public"."commerce_orders"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_facts" ADD CONSTRAINT "inventory_facts_organization_id_store_id_product_id_products_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","product_id") REFERENCES "public"."products"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_facts" ADD CONSTRAINT "inventory_facts_organization_id_store_id_variant_id_variants_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","variant_id") REFERENCES "public"."variants"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_store_id_order_id_commerce_orders_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","order_id") REFERENCES "public"."commerce_orders"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_store_id_product_id_products_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","product_id") REFERENCES "public"."products"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_store_id_variant_id_variants_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","variant_id") REFERENCES "public"."variants"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_organization_id_store_id_customer_id_customers_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","customer_id") REFERENCES "public"."customers"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_organization_id_store_id_product_id_products_organization_id_store_id_id_fk" FOREIGN KEY ("organization_id","store_id","product_id") REFERENCES "public"."products"("organization_id","store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_identity" ON "customers" USING btree ("organization_id","store_id","platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_identity" ON "inventory_facts" USING btree ("organization_id","store_id","platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_unique" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_identity" ON "order_items" USING btree ("organization_id","store_id","platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_identity" ON "commerce_orders" USING btree ("organization_id","store_id","platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_scoped_id" ON "platform_connections" USING btree ("organization_id","store_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_identity" ON "products" USING btree ("organization_id","store_id","platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_idempotency" ON "sync_jobs" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_subject" ON "users" USING btree ("external_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_identity" ON "variants" USING btree ("organization_id","store_id","platform","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_identity" ON "webhook_events" USING btree ("provider","external_event_id");