-- Phase 2A. All money columns are signed BIGINT minor units (halalas for SAR).
CREATE TABLE products (
  id CHAR(36) PRIMARY KEY, organization_id CHAR(36) NOT NULL, store_id CHAR(36) NOT NULL,
  external_id VARCHAR(191), source VARCHAR(24) NOT NULL, name VARCHAR(255) NOT NULL, sku VARCHAR(128),
  status VARCHAR(24) NOT NULL, source_updated_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY products_external_scope (organization_id, store_id, external_id), KEY products_scope (organization_id, store_id)
);
CREATE TABLE variants (
  id CHAR(36) PRIMARY KEY, organization_id CHAR(36) NOT NULL, store_id CHAR(36) NOT NULL, product_id CHAR(36) NOT NULL,
  external_id VARCHAR(191), source VARCHAR(24) NOT NULL, name VARCHAR(255) NOT NULL, sku VARCHAR(128), status VARCHAR(24) NOT NULL,
  source_updated_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY variants_external_scope (organization_id, store_id, external_id), KEY variants_product_scope (organization_id, store_id, product_id)
);
CREATE TABLE commerce_orders (
  id CHAR(36) PRIMARY KEY, organization_id CHAR(36) NOT NULL, store_id CHAR(36) NOT NULL, external_id VARCHAR(191),
  source VARCHAR(24) NOT NULL, status VARCHAR(32) NOT NULL, currency CHAR(3) NOT NULL, merchandise_gross_minor BIGINT NOT NULL,
  discounts_minor BIGINT NOT NULL DEFAULT 0, tax_minor BIGINT NULL, shipping_charged_minor BIGINT NOT NULL DEFAULT 0,
  refunded_minor BIGINT NOT NULL DEFAULT 0, revenue_basis VARCHAR(24) NOT NULL, ordered_at TIMESTAMP NOT NULL,
  source_updated_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY orders_external_scope (organization_id, store_id, external_id), KEY orders_scope_date (organization_id, store_id, ordered_at)
);
CREATE TABLE order_items (
  id CHAR(36) PRIMARY KEY, organization_id CHAR(36) NOT NULL, store_id CHAR(36) NOT NULL, order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL, variant_id CHAR(36) NULL, external_id VARCHAR(191), source VARCHAR(24) NOT NULL,
  title VARCHAR(255) NOT NULL, quantity INT NOT NULL, returned_quantity INT NOT NULL DEFAULT 0,
  unit_gross_minor BIGINT NOT NULL, discount_minor BIGINT NOT NULL DEFAULT 0,
  KEY order_items_scope_order (organization_id, store_id, order_id)
);
CREATE TABLE cost_rules (
  id CHAR(36) PRIMARY KEY, organization_id CHAR(36) NOT NULL, store_id CHAR(36) NOT NULL, category VARCHAR(32) NOT NULL,
  scope VARCHAR(24) NOT NULL, target_id CHAR(36) NULL, name VARCHAR(160) NOT NULL, calculation VARCHAR(24) NOT NULL,
  amount_minor BIGINT NULL, percentage_bps INT NULL, fixed_fee_minor BIGINT NULL, source VARCHAR(24) NOT NULL,
  status VARCHAR(24) NOT NULL, effective_from TIMESTAMP NOT NULL, effective_to TIMESTAMP NULL,
  allocation_strategy VARCHAR(32) NULL, reference_text VARCHAR(255) NULL, notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY cost_rules_effective (organization_id, store_id, category, effective_from, effective_to)
);
CREATE TABLE cost_allocations (
  id CHAR(36) PRIMARY KEY, organization_id CHAR(36) NOT NULL, store_id CHAR(36) NOT NULL, cost_rule_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL, amount_minor BIGINT NOT NULL, strategy VARCHAR(32) NOT NULL, period_from TIMESTAMP NULL, period_to TIMESTAMP NULL,
  source VARCHAR(24) NOT NULL, status VARCHAR(24) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY cost_allocations_scope_order (organization_id, store_id, order_id)
);
