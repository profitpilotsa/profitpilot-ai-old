import { describe, expect, it } from "vitest";
import { money } from "../server/domain/money";
import type { CostAllocation, CostRule, Order, OrderItem, Product, Variant } from "../server/domain/commerce";
import type { DataScope, Id } from "../server/domain/tenant";
import { queryProductProfitabilityOrderLedger } from "../server/application/productProfitabilityOrderLedger";
import type { ProductProfitabilityReadSource } from "../server/application/productProfitabilityDataLoader";

const scope: DataScope = { organizationId: "org", storeId: "store", mode: "live" };
const product = (id: Id): Product => ({ ...scope, id, source: "platform", name: id, status: "active", createdAt: "2026-01-01" });
const order = (id: Id, overrides: Partial<Order> = {}): Order => ({ ...scope, id, source: "platform", status: "paid", currency: "SAR", merchandiseGross: money(1000), discounts: money(0), shippingCharged: money(0), refundedAmount: money(0), revenueBasis: "tax_inclusive", orderedAt: "2026-01-01", ...overrides });
const item = (id: Id, orderId: Id, productId: Id, unitGross = 1000): OrderItem => ({ ...scope, id, orderId, productId, source: "platform", title: id, quantity: 1, returnedQuantity: 0, unitGross: money(unitGross), discountAmount: money(0) });
const rule: CostRule = { ...scope, id: "rule", category: "product_cost", scope: "product", targetId: "product-a", name: "Rule", calculation: "per_unit", amount: money(100), source: "manual", status: "actual", effectiveFrom: "2026-01-01" };
const allocation = (orderId: Id): CostAllocation => ({ ...scope, id: `allocation-${orderId}`, costRuleId: "rule", orderId, amount: money(100), strategy: "manual", source: "manual", status: "actual" });

function sourceWith(calls: string[], overrides: Partial<ProductProfitabilityReadSource> = {}): ProductProfitabilityReadSource {
  const orders = [order("order-a"), order("order-b", { merchandiseGross: money(1500) }), order("order-c", { status: "cancelled" })];
  return {
    listProducts: async () => [product("product-a"), product("product-b")],
    listVariants: async () => [] as Variant[],
    listOrders: async (receivedScope, platform) => { calls.push(`orders:${receivedScope.organizationId}:${receivedScope.storeId}:${platform}`); return orders; },
    listOrderItems: async () => [item("a", "order-a", "product-a"), item("b1", "order-b", "product-a"), item("b2", "order-b", "product-b", 500)],
    listCostRules: async () => [rule],
    listOrderAllocations: async (receivedScope, orderId) => { calls.push(`allocations:${receivedScope.organizationId}:${receivedScope.storeId}:${orderId}`); return orderId === "order-b" ? [allocation(orderId)] : []; },
    ...overrides,
  };
}

describe("Product Profitability Order Ledger query", () => {
  it("preserves loader Order sequence and evaluates each canonical Order exactly once", async () => {
    const calls: string[] = [];
    const ledger = await queryProductProfitabilityOrderLedger({ scope, platform: "salla", calculatedAt: "2026-09-21T00:00:00.000Z", source: sourceWith(calls) });
    expect(ledger.evaluations.map((evaluation) => evaluation.orderId)).toEqual(["order-a", "order-b", "order-c"]);
    expect(ledger.evaluations).toHaveLength(3);
    expect(ledger.evaluations[0]).toMatchObject({ classification: "eligible", productId: "product-a" });
    if (ledger.evaluations[0].classification === "eligible") expect(ledger.evaluations[0].trueCost.calculatedAt).toBe("2026-09-21T00:00:00.000Z");
    expect(ledger.evaluations[1]).toMatchObject({ classification: "unallocated", affectedProductIds: ["product-a", "product-b"] });
    expect(ledger.evaluations[2]).toMatchObject({ classification: "excluded", reasons: ["CANCELLED"] });
    expect(calls).toEqual(expect.arrayContaining(["orders:org:store:salla", "allocations:org:store:order-a", "allocations:org:store:order-b", "allocations:org:store:order-c"]));
  });

  it("returns an empty ledger without allocation reads when the scoped loader returns no Orders", async () => {
    const calls: string[] = [];
    const source = sourceWith(calls, { listOrders: async () => [], listOrderAllocations: async (_scope, orderId) => { calls.push(`unexpected:${orderId}`); return []; } });
    const ledger = await queryProductProfitabilityOrderLedger({ scope, platform: "zid", calculatedAt: "2026-09-21T00:00:00.000Z", source });
    expect(ledger.evaluations).toEqual([]);
    expect(calls.some((call) => call.startsWith("unexpected:"))).toBe(false);
  });

  it("propagates loader failures instead of silently omitting ledger entries", async () => {
    const calls: string[] = [];
    const source = sourceWith(calls, { listOrders: async () => { throw new Error("orders unavailable"); } });
    await expect(queryProductProfitabilityOrderLedger({ scope, platform: "salla", calculatedAt: "2026-09-21T00:00:00.000Z", source })).rejects.toThrow("orders unavailable");
  });
});
