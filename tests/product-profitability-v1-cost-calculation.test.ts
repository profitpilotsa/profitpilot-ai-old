import { describe, expect, it } from "vitest";
import { calculateProductProfitabilityV1OrderCost } from "../server/application/productProfitabilityV1CostCalculation";
import { money } from "../server/domain/money";
import type { CostAllocation, CostRule, Order, OrderItem } from "../server/domain/commerce";

const scope = { organizationId: "org", storeId: "store", mode: "live" as const };
const order: Order = { ...scope, id: "order", source: "platform", status: "paid", currency: "SAR", merchandiseGross: money(1_000), discounts: money(0), shippingCharged: money(0), refundedAmount: money(0), revenueBasis: "tax_inclusive", orderedAt: "2026-01-15" };
const item: OrderItem = { ...scope, id: "item", orderId: order.id, productId: "product", variantId: "variant", source: "platform", title: "Item", quantity: 1, returnedQuantity: 0, unitGross: money(1_000), discountAmount: money(0) };
const rule = (overrides: Partial<CostRule> = {}): CostRule => ({ ...scope, id: "purchase", category: "product_cost", scope: "product", targetId: "product", name: "Purchase", calculation: "per_unit", amount: money(100), source: "manual", status: "actual", effectiveFrom: "2026-01-01", ...overrides });
const allocation = (overrides: Partial<CostAllocation> = {}): CostAllocation => ({ ...scope, id: "allocation", costRuleId: "purchase", orderId: order.id, amount: money(100), strategy: "manual", source: "manual", status: "actual", ...overrides });
const calculate = (rules: readonly CostRule[], allocations: readonly CostAllocation[] = []) => calculateProductProfitabilityV1OrderCost({ order, items: [item], rules, allocations, calculatedAt: "2026-09-22T00:00:00.000Z" });

describe("Product Profitability V1 Order Cost", () => {
  it("includes supported Product and Variant direct costs only", () => {
    const result = calculate([
      rule(),
      rule({ id: "packaging", category: "packaging", scope: "variant", targetId: "variant", amount: money(20) }),
      rule({ id: "shipping", category: "shipping", scope: "variant", targetId: "variant", amount: money(30) }),
      rule({ id: "customs", category: "customs", amount: money(40) }),
    ]);
    expect(result).toMatchObject({ status: "actual", revenue: money(1_000), directCost: money(190), directProfit: money(810) });
  });

  it("excludes Store-level advertising, subscription, freight, and packaging", () => {
    const result = calculate([
      rule(),
      rule({ id: "advertising", category: "advertising", scope: "store", amount: money(500) }),
      rule({ id: "subscription", category: "subscription", scope: "store", amount: money(500) }),
      rule({ id: "freight", category: "shipping", scope: "store", amount: money(500) }),
      rule({ id: "packaging", category: "packaging", scope: "store", amount: money(500) }),
    ]);
    expect(result).toMatchObject({ status: "actual", directCost: money(100), directProfit: money(900) });
  });

  it("does not treat configured payment-fee rules as actual transaction costs", () => {
    const result = calculate([rule(), rule({ id: "payment", category: "payment_fee", scope: "order", calculation: "percentage", amount: undefined, percentageBps: 250 })]);
    expect(result.directCost).toBe(money(100));
    expect(result.status).toBe("incomplete");
    expect(result.missingComponents).toContain("Unallocated Product Profitability cost facts");
  });

  it("keeps an Order-linked CostAllocation out of arithmetic", () => {
    const result = calculate([rule()], [allocation({ id: "unknown-allocation", costRuleId: "unknown-rule", amount: money(900) })]);
    expect(result.directCost).toBe(money(100));
    expect(result.status).toBe("incomplete");
    expect(result.missingComponents).toContain("Unallocated Cost Allocation facts");
  });

  it("preserves Rule plus Allocation ambiguity without double-counting", () => {
    const result = calculate([rule()], [allocation({ amount: money(900) })]);
    expect(result.directCost).toBe(money(0));
    expect(result.status).toBe("incomplete");
    expect(result.missingComponents).toContain("Cost Rule and Cost Allocation precedence");
  });

  it("marks missing purchase cost incomplete rather than treating it as zero", () => {
    const result = calculate([rule({ id: "packaging", category: "packaging", amount: money(20) })]);
    expect(result.directCost).toBe(money(20));
    expect(result).toMatchObject({ status: "incomplete", directProfit: null });
    expect(result.missingComponents).toContain("Product cost");
  });

  it("preserves genuine incomplete direct inputs", () => {
    const result = calculate([rule({ status: "incomplete", amount: undefined })]);
    expect(result).toMatchObject({ status: "incomplete", directProfit: null });
    expect(result.missingComponents).toContain("Product cost");
  });
});
