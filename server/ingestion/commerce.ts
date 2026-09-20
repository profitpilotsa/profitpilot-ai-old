import type { Customer } from "../domain/customer";
import type { Order, OrderItem, Product, Variant } from "../domain/commerce";
import type { InventoryState } from "../domain/inventory";
import type { DataScope, Id, Platform } from "../domain/tenant";

export type CanonicalEntity = "product" | "variant" | "customer" | "order" | "order_item" | "inventory";
type EntityRecord = { product: Product; variant: Variant; customer: Customer; order: Order; order_item: OrderItem; inventory: InventoryState };
export interface IngestionMetadata { platform: Platform; externalId: string; sourceUpdatedAt?: string; ingestedAt: string; status?: string; rawReference?: string; }
export type NormalizedCommerceRecord<E extends CanonicalEntity = CanonicalEntity> = { entity: E; scope: DataScope; metadata: IngestionMetadata; record: EntityRecord[E] };
const hash = (value: string) => { let hash = 2166136261; for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(16).padStart(8, "0"); };
/** Stable internal ProfitPilot ID (UUID-shaped, CHAR(36)-compatible); provider identity stays external. */
export const canonicalId = (scope: DataScope, platform: Platform, entity: CanonicalEntity, externalId: string): Id => { const seed = `${scope.organizationId}|${scope.storeId ?? "organization"}|${platform}|${entity}|${externalId}`; const hex = `${hash(seed)}${hash(`a${seed}`)}${hash(`b${seed}`)}${hash(`c${seed}`)}`; return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`; };
export function normalizeRecord<E extends CanonicalEntity>(entity: E, scope: DataScope, metadata: IngestionMetadata, fields: Omit<EntityRecord[E], "id" | "organizationId" | "storeId" | "mode" | "externalId" | "source">): NormalizedCommerceRecord<E> {
  if (!metadata.externalId) throw new Error("Platform ingestion requires an external ID");
  const record = { ...fields, id: canonicalId(scope, metadata.platform, entity, metadata.externalId), organizationId: scope.organizationId, storeId: scope.storeId, mode: scope.mode, externalId: metadata.externalId, source: "platform", ...(metadata.sourceUpdatedAt ? { sourceUpdatedAt: metadata.sourceUpdatedAt } : {}) } as EntityRecord[E];
  return { entity, scope, metadata, record };
}
