import type { DataScope } from "../domain/tenant";
import type { CanonicalEntity, NormalizedCommerceRecord } from "../ingestion/commerce";
const sameScope = (scope: DataScope, record: DataScope) => record.organizationId === scope.organizationId && record.storeId === scope.storeId;
const key = (entity: CanonicalEntity, scope: DataScope, platform: string, externalId: string) => `${entity}:${scope.organizationId}:${scope.storeId ?? "organization"}:${platform}:${externalId}`;
export class ScopedCommerceRepository {
  private readonly records = new Map<string, NormalizedCommerceRecord>();
  upsert<E extends CanonicalEntity>(input: NormalizedCommerceRecord<E>): NormalizedCommerceRecord<E> { if (!sameScope(input.scope, input.record)) throw new Error("Scoped ingestion record does not match its target scope"); const recordKey = key(input.entity, input.scope, input.metadata.platform, input.metadata.externalId); const existing = this.records.get(recordKey); const next = { ...input, record: { ...existing?.record, ...input.record } } as NormalizedCommerceRecord<E>; this.records.set(recordKey, next); return next; }
  find<E extends CanonicalEntity>(entity: E, scope: DataScope, platform: string, externalId: string): NormalizedCommerceRecord<E> | undefined { const result = this.records.get(key(entity, scope, platform, externalId)); return result && sameScope(scope, result.record) ? result as NormalizedCommerceRecord<E> : undefined; }
  list<E extends CanonicalEntity>(entity: E, scope: DataScope): NormalizedCommerceRecord<E>[] { return [...this.records.values()].filter(record => record.entity === entity && sameScope(scope, record.record)) as NormalizedCommerceRecord<E>[]; }
}
