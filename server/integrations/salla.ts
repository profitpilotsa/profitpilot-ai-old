import type { CommerceReadAdapter, ProviderConnection, ProviderPage, SyncCursor } from "./contracts";
import type { Order, OrderItem, Product, Variant } from "../domain/commerce";
import type { Customer } from "../domain/customer";

/**
 * Salla transport is intentionally injected. Real endpoint/scopes/token handling remain
 * disabled until the owner approves the verified Partner configuration.
 */
export interface SallaReadClient {
  products(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Product>>;
  variants(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Variant>>;
  customers(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Customer>>;
  orders(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<{ order: Order; items: readonly OrderItem[] }>>;
}
export class SallaReadOnlyAdapter implements CommerceReadAdapter {
  readonly platform = "salla" as const;
  constructor(private readonly client: SallaReadClient) {}
  listProducts(connection: ProviderConnection, cursor?: SyncCursor) { return this.client.products(connection, cursor); }
  listVariants(connection: ProviderConnection, cursor?: SyncCursor) { return this.client.variants(connection, cursor); }
  listCustomers(connection: ProviderConnection, cursor?: SyncCursor) { return this.client.customers(connection, cursor); }
  listOrders(connection: ProviderConnection, cursor?: SyncCursor) { return this.client.orders(connection, cursor); }
}
