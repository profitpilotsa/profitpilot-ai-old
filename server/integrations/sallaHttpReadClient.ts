import type { Customer } from "../domain/customer";
import type { Order, OrderItem, Product, Variant } from "../domain/commerce";
import type { DataScope } from "../domain/tenant";
import type { ProviderConnection, ProviderPage, SyncCursor } from "./contracts";
import { SallaCanonicalMapper, type SallaCustomerRecord, type SallaOrderItemRecord, type SallaOrderRecord, type SallaProductRecord, type SallaVariantRecord } from "./sallaMapper";

const apiBase = "https://api.salla.dev/admin/v2";
type Fetch = typeof fetch;
type ApiPage = { data?: unknown; pagination?: { currentPage?: unknown; totalPages?: unknown } };

/** Server-only, GET-only Salla transport. It never logs or persists its token. */
export class SallaHttpReadClient {
  private readonly mapper: SallaCanonicalMapper;
  private readonly seenProductIds = new Set<string>();

  constructor(private readonly scope: DataScope, private readonly accessToken: string, private readonly request: Fetch = fetch) {
    if (scope.mode !== "live") throw new Error("Salla reads require a live scope");
    if (!accessToken.trim()) throw new Error("A Salla access token is required");
    this.mapper = new SallaCanonicalMapper(scope);
  }

  async products(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Product>> {
    this.assertConnection(connection);
    const page = await this.getPage("/products", cursor);
    const records = recordsOf<SallaProductRecord>(page).map(record => {
      const product = this.mapper.product(record); this.seenProductIds.add(product.externalId!); return product;
    });
    return { records, next: nextCursor(page) };
  }

  async variants(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Variant>> {
    this.assertConnection(connection);
    if (cursor) throw new Error("Salla variants are consumed as a complete product-scoped read");
    if (this.seenProductIds.size === 0) throw new Error("Salla products must be read before variants");
    const records: Variant[] = [];
    for (const productId of this.seenProductIds) {
      let pageCursor: SyncCursor | undefined;
      do {
        const page = await this.getPage(`/products/${encodeURIComponent(productId)}/variants`, pageCursor);
        records.push(...recordsOf<SallaVariantRecord>(page).map(record => this.mapper.variant(productId, record)));
        pageCursor = nextCursor(page);
      } while (pageCursor);
    }
    return { records };
  }

  async customers(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<Customer>> {
    this.assertConnection(connection);
    const page = await this.getPage("/customers", cursor);
    return { records: recordsOf<SallaCustomerRecord>(page).map(record => this.mapper.customer(record)), next: nextCursor(page) };
  }

  async orders(connection: ProviderConnection, cursor?: SyncCursor): Promise<ProviderPage<{ order: Order; items: readonly OrderItem[] }>> {
    this.assertConnection(connection);
    const page = await this.getPage("/orders", cursor);
    const records: { order: Order; items: readonly OrderItem[] }[] = [];
    for (const sourceOrder of recordsOf<SallaOrderRecord>(page)) {
      const details = await this.getObject<SallaOrderRecord>(`/orders/${encodeURIComponent(String(sourceOrder.id))}`);
      const order = this.mapper.order(details);
      const itemsPage = await this.getPage("/orders/items", undefined, { order_id: sourceOrder.id });
      const items = recordsOf<SallaOrderItemRecord>(itemsPage).map(item => this.mapper.orderItem(sourceOrder.id, item));
      records.push({ order, items });
    }
    return { records, next: nextCursor(page) };
  }

  private assertConnection(connection: ProviderConnection): void {
    if (connection.provider !== "salla" || connection.status !== "connected" || connection.scope.organizationId !== this.scope.organizationId || connection.scope.storeId !== this.scope.storeId || connection.scope.mode !== "live") throw new Error("The Salla connection is outside the authorized live scope");
  }

  private async getPage(path: string, cursor?: SyncCursor, parameters: Record<string, string | number> = {}): Promise<ApiPage> {
    const url = new URL(`${apiBase}${path}`);
    url.searchParams.set("per_page", "30");
    if (cursor?.value) url.searchParams.set("page", cursor.value);
    for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, String(value));
    const response = await this.request(url, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) throw new Error("Salla read request failed");
    const page: unknown = await response.json();
    if (!page || typeof page !== "object" || Array.isArray(page)) throw new Error("Salla read response is invalid");
    return page as ApiPage;
  }

  private async getObject<T>(path: string): Promise<T> {
    const page = await this.getPage(path);
    if (!page.data || typeof page.data !== "object" || Array.isArray(page.data)) throw new Error("Salla object response is invalid");
    return page.data as T;
  }
}

function recordsOf<T>(page: ApiPage): T[] { return Array.isArray(page.data) ? page.data as T[] : []; }
function nextCursor(page: ApiPage): SyncCursor | undefined {
  const current = Number(page.pagination?.currentPage); const total = Number(page.pagination?.totalPages);
  return Number.isSafeInteger(current) && Number.isSafeInteger(total) && current >= 1 && current < total ? { value: String(current + 1) } : undefined;
}
