import { describe, expect, it } from "vitest";
import { classifyProductProfitabilityV1Costs } from "../server/application/productProfitabilityCostPolicy";
import { money } from "../server/domain/money";
import type { CostAllocation, CostRule, Order, OrderItem } from "../server/domain/commerce";

const scope = { organizationId: "org", storeId: "store", mode: "live" as const };
const order: Order = { ...scope, id: "order", source: "platform", status: "paid", currency: "SAR", merchandiseGross: money(1000), discounts: money(0), shippingCharged: money(0), refundedAmount: money(0), revenueBasis: "tax_inclusive", orderedAt: "2026-01-15" };
const item: OrderItem = { ...scope, id: "item", orderId: order.id, productId: "product", variantId: "variant", source: "platform", title: "Item", quantity: 1, returnedQuantity: 0, unitGross: money(1000), discountAmount: money(0) };
const rule = (overrides: Partial<CostRule> = {}): CostRule => ({ ...scope, id: "rule", category: "product_cost", scope: "product", targetId: "product", name: "Rule", calculation: "per_unit", amount: money(100), source: "manual", status: "actual", effectiveFrom: "2026-01-01", ...overrides });
const allocation = (overrides: Partial<CostAllocation> = {}): CostAllocation => ({ ...scope, id: "allocation", costRuleId: "rule", orderId: order.id, amount: money(100), strategy: "manual", source: "manual", status: "actual", ...overrides });
const classify = (rules: readonly CostRule[], allocations: readonly CostAllocation[] = []) => classifyProductProfitabilityV1Costs({ order, items: [item], rules, allocations });

describe("Product Profitability V1 Cost Policy", () => {
  it("classifies explicit Product and Variant direct costs", () => {
    const result = classify([
      rule(),
      rule({ id: "packaging", category: "packaging", scope: "variant", targetId: "variant" }),
      rule({ id: "customs", category: "customs", scope: "product", targetId: "product" }),
      rule({ id: "shipping", category: "shipping", scope: "variant", targetId: "variant" }),
      rule({ id: "custom", category: "other", scope: "product", targetId: "product" }),
    ]);
    expect(result.rules.every((candidate) => candidate.classification === "PRODUCT_DIRECT")).toBe(true);
  });

  it("keeps general store expenses at Store level", () => {
    const result = classify([
      rule({ id: "advertising", category: "advertising", scope: "store" }),
      rule({ id: "subscription", category: "subscription", scope: "store" }),
      rule({ id: "freight", category: "shipping", scope: "store" }),
      rule({ id: "packaging", category: "packaging", scope: "store" }),
      rule({ id: "other", category: "other", scope: "store" }),
    ]);
    expect(result.rules.every((candidate) => candidate.classification === "STORE_LEVEL")).toBe(true);
  });

  it("does not treat configured payment-fee rules as actual transaction facts", () => {
    expect(classify([rule({ category: "payment_fee", scope: "order", calculation: "percentage", percentageBps: 250, amount: undefined })]).rules[0]).toMatchObject({ classification: "UNALLOCATED_UNTIL_KNOWN" });
  });

  it("keeps an Order-linked Allocation unallocated without authoritative fact semantics", () => {
    expect(classify([], [allocation()]).allocations[0]).toMatchObject({ classification: "UNALLOCATED_UNTIL_KNOWN" });
  });

  it("exposes Rule plus Allocation ambiguity without choosing precedence or double-counting", () => {
    const result = classify([rule()], [allocation()]);
    expect(result.ambiguousCostRuleIds).toEqual(["rule"]);
    expect(result.rules[0]).toMatchObject({ classification: "UNALLOCATED_UNTIL_KNOWN" });
    expect(result.allocations[0]).toMatchObject({ classification: "UNALLOCATED_UNTIL_KNOWN" });
  });

  it("keeps unknown, non-applicable, and cross-scope candidates unallocated", () => {
    const result = classify([
      rule({ id: "wrong-target", targetId: "other" }),
      rule({ id: "order-product-cost", scope: "order" }),
      rule({ id: "other-store", organizationId: "other" }),
    ]);
    expect(result.rules.every((candidate) => candidate.classification === "UNALLOCATED_UNTIL_KNOWN")).toBe(true);
  });
});
