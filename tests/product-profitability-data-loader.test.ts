import { describe, expect, it } from "vitest";
import type { CostAllocation, CostRule, Order, OrderItem, Product, Variant } from "../server/domain/commerce";
import type { DataScope, Id } from "../server/domain/tenant";
import { loadProductProfitabilityScopedData, type ProductProfitabilityReadSource } from "../server/application/productProfitabilityDataLoader";

const scope: DataScope = { organizationId: "org", storeId: "store", mode: "live" };
const product = { ...scope, id: "product", source: "platform", name: "Product", status: "active", createdAt: "2026-01-01" } as Product;
const variant = { ...scope, id: "variant", productId: "product", source: "platform", name: "Variant", status: "active", createdAt: "2026-01-01" } as Variant;
const order = (id: Id): Order => ({ ...scope, id, source: "platform", status: "paid", currency: "SAR", merchandiseGross: 1000 as Order["merchandiseGross"], discounts: 0 as Order["discounts"], shippingCharged: 0 as Order["shippingCharged"], refundedAmount: 0 as Order["refundedAmount"], revenueBasis: "tax_inclusive", orderedAt: "2026-01-01" });
const item = { ...scope, id: "item", orderId: "order-a", productId: "product", source: "platform", title: "Item", quantity: 1, returnedQuantity: 0, unitGross: 1000 as OrderItem["unitGross"], discountAmount: 0 as OrderItem["discountAmount"] } as OrderItem;
const rule = { ...scope, id: "rule", category: "product_cost", scope: "product", targetId: "product", name: "Rule", calculation: "per_unit", source: "manual", status: "not_configured", effectiveFrom: "2026-01-01" } as CostRule;
const allocation = (orderId: Id) => ({ ...scope, id: `allocation-${orderId}`, costRuleId: "rule", orderId, amount: 100 as CostAllocation["amount"], strategy: "manual", source: "manual", status: "actual" } as CostAllocation);

function sourceWith(calls: string[], overrides: Partial<ProductProfitabilityReadSource> = {}): ProductProfitabilityReadSource {
  return {
    listProducts: async (receivedScope, platform) => { calls.push(`products:${receivedScope.organizationId}:${receivedScope.storeId}:${platform}`); return [product]; },
    listVariants: async (receivedScope, platform) => { calls.push(`variants:${receivedScope.organizationId}:${receivedScope.storeId}:${platform}`); return [variant]; },
    listOrders: async (receivedScope, platform) => { calls.push(`orders:${receivedScope.organizationId}:${receivedScope.storeId}:${platform}`); return [order("order-a"), order("order-b")]; },
    listOrderItems: async (receivedScope, platform) => { calls.push(`items:${receivedScope.organizationId}:${receivedScope.storeId}:${platform}`); return [item]; },
    listCostRules: async (receivedScope) => { calls.push(`rules:${receivedScope.organizationId}:${receivedScope.storeId}`); return [rule]; },
    listOrderAllocations: async (receivedScope, orderId) => { calls.push(`allocations:${receivedScope.organizationId}:${receivedScope.storeId}:${orderId}`); return orderId === "order-a" ? [allocation(orderId)] : []; },
    ...overrides,
  };
}

describe("Product Profitability scoped data loader", () => {
  it("loads canonical collections through their established scoped read boundaries", async () => {
    const calls: string[] = [];
    const result = await loadProductProfitabilityScopedData({ scope, platform: "salla", source: sourceWith(calls) });
    expect(result).toMatchObject({ products: [product], variants: [variant], orders: [order("order-a"), order("order-b")], orderItems: [item], costRules: [rule] });
    expect(calls).toEqual(expect.arrayContaining(["products:org:store:salla", "variants:org:store:salla", "orders:org:store:salla", "items:org:store:salla", "rules:org:store", "allocations:org:store:order-a", "allocations:org:store:order-b"]));
    expect(result.allocationsByOrderId.get("order-a")).toEqual([allocation("order-a")]);
    expect(result.allocationsByOrderId.get("order-b")).toEqual([]);
  });

  it("does not request allocations when no scoped Orders exist and preserves empty collections", async () => {
    const calls: string[] = [];
    const source = sourceWith(calls, { listProducts: async () => [], listVariants: async () => [], listOrders: async () => [], listOrderItems: async () => [], listCostRules: async () => [] });
    const result = await loadProductProfitabilityScopedData({ scope, platform: "zid", source });
    expect(result).toMatchObject({ products: [], variants: [], orders: [], orderItems: [], costRules: [] });
    expect(result.allocationsByOrderId.size).toBe(0);
    expect(calls.some((call) => call.startsWith("allocations:"))).toBe(false);
  });

  it("preserves repository failures instead of silently producing empty source data", async () => {
    const calls: string[] = [];
    const source = sourceWith(calls, { listProducts: async () => { throw new Error("source unavailable"); } });
    await expect(loadProductProfitabilityScopedData({ scope, platform: "salla", source })).rejects.toThrow("source unavailable");
  });
});
