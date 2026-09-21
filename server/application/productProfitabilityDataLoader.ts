import type { CostAllocation, CostRule, Order, OrderItem, Product, Variant } from "../domain/commerce";
import type { DataScope, Id } from "../domain/tenant";

export interface ProductProfitabilityReadSource {
  listProducts(scope: DataScope, platform: string): Promise<readonly Product[]>;
  listVariants(scope: DataScope, platform: string): Promise<readonly Variant[]>;
  listOrders(scope: DataScope, platform: string): Promise<readonly Order[]>;
  listOrderItems(scope: DataScope, platform: string): Promise<readonly OrderItem[]>;
  listCostRules(scope: DataScope): Promise<readonly CostRule[]>;
  listOrderAllocations(scope: DataScope, orderId: Id): Promise<readonly CostAllocation[]>;
}

export interface ProductProfitabilityScopedData {
  products: readonly Product[];
  variants: readonly Variant[];
  orders: readonly Order[];
  orderItems: readonly OrderItem[];
  costRules: readonly CostRule[];
  allocationsByOrderId: ReadonlyMap<Id, readonly CostAllocation[]>;
}

export interface ProductProfitabilityScopedDataLoaderInput {
  scope: DataScope;
  platform: string;
  source: ProductProfitabilityReadSource;
}

export async function loadProductProfitabilityScopedData(input: ProductProfitabilityScopedDataLoaderInput): Promise<ProductProfitabilityScopedData> {
  const { scope, platform, source } = input;
  const [products, variants, orders, orderItems, costRules] = await Promise.all([
    source.listProducts(scope, platform),
    source.listVariants(scope, platform),
    source.listOrders(scope, platform),
    source.listOrderItems(scope, platform),
    source.listCostRules(scope),
  ]);
  const allocationsByOrderId = new Map<Id, readonly CostAllocation[]>(await Promise.all(
    orders.map(async (order) => [order.id, await source.listOrderAllocations(scope, order.id)] as const),
  ));
  return { products, variants, orders, orderItems, costRules, allocationsByOrderId };
}
