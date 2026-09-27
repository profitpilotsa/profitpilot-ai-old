import { assertLiveProviderAction, authorize, type RequestContext } from "../phase1";
import type { SallaReadOnlyAdapter } from "../integrations/salla";
import type { ProviderConnection, ProviderPage, SyncCursor } from "../integrations/contracts";
import type { PostgresCommerceRepository } from "../repositories/postgresCommerce";

/** Governed read-only ingestion. This service has no provider mutation operation. */
export class SallaReadOnlySyncService {
  constructor(private readonly adapter: SallaReadOnlyAdapter, private readonly repository: PostgresCommerceRepository) {}
  async initialSync(context: RequestContext, connection: ProviderConnection, ingestedAt = new Date()) {
    authorize(context, "integration.sync");
    assertLiveProviderAction(context);
    return this.runInitialSync(connection, ingestedAt);
  }
  /** Used only after a durable job resolved a repository-verified live connection. */
  async runInitialSync(connection: ProviderConnection, ingestedAt = new Date()) {
    if (connection.provider !== "salla" || connection.scope.mode !== "live") throw new Error("The Salla connection is outside the authorized live store scope");
    const products = await readAll(cursor => this.adapter.listProducts(connection, cursor));
    for (const item of products) await this.repository.upsertProduct(item, "salla", ingestedAt);
    const variants = await readAll(cursor => this.adapter.listVariants(connection, cursor));
    for (const item of variants) await this.repository.upsertVariant(item, "salla", ingestedAt);
    const customers = await readAll(cursor => this.adapter.listCustomers(connection, cursor));
    for (const item of customers) await this.repository.upsertCustomer(item, "salla", ingestedAt);
    const orders = await readAll(cursor => this.adapter.listOrders(connection, cursor));
    for (const item of orders) await this.repository.persistOrderWithItems(item.order, "salla", ingestedAt, item.items);
    return { products: products.length, variants: variants.length, customers: customers.length, orders: orders.length };
  }
}

/** Provider pages are consumed sequentially: Salla's order pagination requires it. */
async function readAll<T>(readPage: (cursor?: SyncCursor) => Promise<ProviderPage<T>>): Promise<T[]> {
  const records: T[] = [];
  const seen = new Set<string>();
  let cursor: SyncCursor | undefined;
  do {
    const page = await readPage(cursor);
    records.push(...page.records);
    cursor = page.next;
    if (cursor) {
      const key = JSON.stringify(cursor);
      if (seen.has(key)) throw new Error("Salla pagination cursor repeated");
      seen.add(key);
    }
  } while (cursor);
  return records;
}
