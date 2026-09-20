-- Canonical platform-derived facts only. ProfitPilot-owned cost rules remain in 0002 tables.
CREATE TABLE customers (
  id CHAR(36) PRIMARY KEY, organization_id CHAR(36) NOT NULL, store_id CHAR(36) NOT NULL,
  external_id VARCHAR(191), source VARCHAR(24) NOT NULL, display_name VARCHAR(255) NULL,
  email VARCHAR(320) NULL, phone VARCHAR(64) NULL, status VARCHAR(24) NOT NULL,
  source_updated_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY customers_external_scope (organization_id, store_id, external_id), KEY customers_scope (organization_id, store_id)
);
CREATE TABLE inventory_facts (
  id CHAR(36) PRIMARY KEY, organization_id CHAR(36) NOT NULL, store_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL, variant_id CHAR(36) NULL, current_stock INT NULL, available_stock INT NULL,
  reserved_stock INT NULL, inbound_stock INT NULL, source VARCHAR(24) NOT NULL, status VARCHAR(24) NOT NULL,
  observed_at TIMESTAMP NOT NULL, source_updated_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY inventory_external_scope (organization_id, store_id, product_id, variant_id), KEY inventory_scope (organization_id, store_id, product_id)
);
