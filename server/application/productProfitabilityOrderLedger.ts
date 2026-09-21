import type { DataScope, Id } from "../domain/tenant";
import { loadProductProfitabilityScopedData, type ProductProfitabilityReadSource } from "./productProfitabilityDataLoader";
import { evaluateProductProfitabilityOrder, type ProductProfitabilityOrderEvaluation } from "./productProfitabilityOrderEvaluation";

export interface ProductProfitabilityOrderLedgerInput {
  scope: DataScope;
  platform: string;
  calculatedAt: string;
  source: ProductProfitabilityReadSource;
}

export interface ProductProfitabilityOrderLedger {
  evaluations: readonly ProductProfitabilityOrderEvaluation[];
}

export async function queryProductProfitabilityOrderLedger(input: ProductProfitabilityOrderLedgerInput): Promise<ProductProfitabilityOrderLedger> {
  const { scope, platform, calculatedAt, source } = input;
  const data = await loadProductProfitabilityScopedData({ scope, platform, source });
  const itemsByOrderId = new Map<Id, readonly typeof data.orderItems[number][]>();
  for (const item of data.orderItems) {
    const items = itemsByOrderId.get(item.orderId) ?? [];
    itemsByOrderId.set(item.orderId, [...items, item]);
  }
  const evaluations = data.orders.map((order) => {
    const allocations = data.allocationsByOrderId.get(order.id);
    if (!allocations) throw new Error(`Scoped data loader omitted allocation collection for Order ${order.id}`);
    return evaluateProductProfitabilityOrder({
      scope,
      platform,
      order,
      items: itemsByOrderId.get(order.id) ?? [],
      products: data.products,
      variants: data.variants,
      rules: data.costRules,
      allocations,
      calculatedAt,
    });
  });
  return { evaluations };
}
