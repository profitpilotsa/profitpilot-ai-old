import type { Customer } from "../domain/customer";
import type { Order, OrderItem, Product, Variant } from "../domain/commerce";
import type { InventoryState } from "../domain/inventory";
import type { DataScope, Id, Platform } from "../domain/tenant";

export type CanonicalEntity = "product" | "variant" | "customer" | "order" | "order_item" | "inventory";
export interface IngestionMetadata { platform: Platform; externalId: string; sourceUpdatedAt?: string; ingestedAt: string; status?: string; rawReference?: string; }
export type CanonicalRecord = Product | Variant | Customer | Order | OrderItem | InventoryState;
export interface NormalizedCommerceRecord<T extends CanonicalRecord = CanonicalRecord> { entity: CanonicalEntity; scope: DataScope; metadata: IngestionMetadata; record: T; }
export const canonicalId = (scope: DataScope, platform: Platform, entity: CanonicalEntity, externalId: string): Id => `${scope.organizationId}:${scope.storeId ?? "organization"}:${platform}:${entity}:${externalId}`;

/** Adapters translate provider payloads into this shape; engines never receive provider payloads. */
export function normalizeRecord<T extends CanonicalRecord>(entity: CanonicalEntity, scope: DataScope, metadata: IngestionMetadata, fields: Omit<T, "id" | "organizationId" | "storeId" | "mode" | "externalId" | "source">): NormalizedCommerceRecord<T> {
  return { entity, scope, metadata, record: { ...fields, id: canonicalId(scope, metadata.platform, entity, metadata.externalId), organizationId: scope.organizationId, storeId: scope.storeId, mode: scope.mode, externalId: metadata.externalId, source: "platform" } as T };
}
