import type { Mode, Platform, Scope } from "../phase1";
import type { Order, OrderItem, Product, Variant } from "../domain/commerce";
import type { Customer } from "../domain/customer";

export interface ProviderConnection { id: string; scope: Scope; provider: Platform; credentialReference?: string; status: "not_connected" | "requires_setup" | "connected" | "error"; }
export interface SyncCursor { value?: string; updatedAfter?: string; }
export interface ProviderPage<T> { records: readonly T[]; next?: SyncCursor; sourceObservedAt?: string; }
export interface CommerceReadAdapter {
  readonly platform: Platform;
  listProducts(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Product>>;
  listVariants(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Variant>>;
  listCustomers(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Customer>>;
  listOrders(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<{ order: Order; items: readonly OrderItem[] }>>;
}
export function assertReadOnlyConnection(connection: ProviderConnection): void {
  if (connection.scope.mode !== "live") throw new Error("A provider connection cannot be used from Demo mode");
  if (connection.status !== "connected") throw new Error("A connected provider authorization is required");
}
export interface OAuthState { id: string; organizationId: string; storeId: string; provider: Platform; redirectUri: string; expiresAt: string; mode: Mode; }
