import type { Customer } from "../domain/customer";
import type { Order, OrderItem, Product, Variant } from "../domain/commerce";
import type { InventoryState } from "../domain/inventory";
import type { DataScope, Id } from "../domain/tenant";
import type { CanonicalEntity, CanonicalRecord, NormalizedCommerceRecord } from "../ingestion/commerce";

const sameScope = (scope: DataScope, record: DataScope) => record.organizationId === scope.organizationId && record.storeId === scope.storeId;
const key = (entity: CanonicalEntity, scope: DataScope, externalId: string) => `${entity}:${scope.organizationId}:${scope.storeId ?? "organization"}:${externalId}`;
export class ScopedCommerceRepository {
  private readonly records = new Map<string, CanonicalRecord>();
  upsert<T extends CanonicalRecord>(input: NormalizedCommerceRecord<T>): T {
    if (!sameScope(input.scope, input.record)) throw new Error("Scoped ingestion record does not match its target scope");
    const recordKey = key(input.entity, input.scope, input.metadata.externalId);
    const existing = this.records.get(recordKey);
    const next = { ...existing, ...input.record } as T;
    this.records.set(recordKey, next); return next;
  }
  find<T extends CanonicalRecord>(entity: CanonicalEntity, scope: DataScope, externalId: string): T | undefined {
    const result = this.records.get(key(entity, scope, externalId)); return result && sameScope(scope, result as DataScope) ? result as T : undefined;
  }
  list<T extends CanonicalRecord>(entity: CanonicalEntity, scope: DataScope): T[] { return [...this.records.values()].filter((record) => entityFor(record) === entity && sameScope(scope, record as DataScope)) as T[]; }
}
const entityFor = (record: CanonicalRecord): CanonicalEntity => "orderedAt" in record ? "order" : "quantity" in record ? "order_item" : "availableStock" in record || "currentStock" in record ? "inventory" : "displayName" in record || "phone" in record ? "customer" : "productId" in record ? "variant" : "product";
export type CommerceLookup = { findProduct(scope: DataScope, id: Id): Promise<Product | undefined>; listVariants(scope: DataScope, productId: Id): Promise<Variant[]>; findOrder(scope: DataScope, id: Id): Promise<Order | undefined>; listOrderItems(scope: DataScope, orderId: Id): Promise<OrderItem[]>; findCustomer(scope: DataScope, id: Id): Promise<Customer | undefined>; findInventory(scope: DataScope, productId: Id, variantId?: Id): Promise<InventoryState | undefined>; };
