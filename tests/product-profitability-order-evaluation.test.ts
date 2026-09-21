import { describe, expect, it } from "vitest";
import { money } from "../server/domain/money";
import type { CostAllocation, CostRule, Order, OrderItem, Product, Variant } from "../server/domain/commerce";
import { classifyProductProfitabilityOrder } from "../server/application/productProfitabilityEligibility";
import { evaluateProductProfitabilityOrder } from "../server/application/productProfitabilityOrderEvaluation";

const scope = { organizationId: "org", storeId: "store", mode: "live" as const };
const product = (id: string): Product => ({ ...scope, id, source: "platform", name: id, status: "active", createdAt: "2026-01-01" });
const order = (overrides: Partial<Order> = {}): Order => ({ ...scope, id: "order", source: "platform", status: "paid", currency: "SAR", merchandiseGross: money(1000), discounts: money(0), shippingCharged: money(25), refundedAmount: money(0), taxAmount: money(150), revenueBasis: "tax_inclusive", orderedAt: "2026-01-15", ...overrides });
const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({ ...scope, id: "item", orderId: "order", productId: "product-a", source: "platform", title: "Item", quantity: 1, returnedQuantity: 0, unitGross: money(1000), discountAmount: money(0), ...overrides });
const rule = (overrides: Partial<CostRule> = {}): CostRule => ({ ...scope, id: "rule", category: "product_cost", scope: "product", targetId: "product-a", name: "Rule", calculation: "per_unit", amount: money(100), source: "manual", status: "actual", effectiveFrom: "2026-01-01", ...overrides });
const evaluate = (overrides: Partial<Parameters<typeof evaluateProductProfitabilityOrder>[0]> = {}) => evaluateProductProfitabilityOrder({ scope, platform: "salla", order: order(), items: [item()], products: [product("product-a")], variants: [] as Variant[], rules: [] as CostRule[], allocations: [] as CostAllocation[], calculatedAt: "2026-09-21T00:00:00.000Z", ...overrides });

describe("Product Profitability per-Order evaluation", () => {
  it("evaluates a safe paid Order once through True Cost with caller-supplied time", () => {
    const result = evaluate();
    expect(result).toMatchObject({ classification: "eligible", productId: "product-a", orderId: "order" });
    if (result.classification !== "eligible") throw new Error("Expected eligible evaluation");
    expect(result.trueCost.calculatedAt).toBe("2026-09-21T00:00:00.000Z");
    expect(result.trueCost.status).toBe("incomplete");
  });

  it("preserves fulfilled eligibility and an unchanged incomplete True Cost result", () => {
    const result = evaluate({ order: order({ status: "fulfilled" }) });
    expect(result).toMatchObject({ classification: "eligible" });
    if (result.classification !== "eligible") throw new Error("Expected eligible evaluation");
    expect(result.trueCost.status).toBe("incomplete");
  });

  it("keeps mixed and unknown Product Orders unallocated without True Cost or Product money", () => {
    const second = item({ id: "second", productId: "product-b", unitGross: money(500) });
    const mixed = evaluate({ order: order({ merchandiseGross: money(1500) }), items: [item(), second], products: [product("product-a"), product("product-b")] });
    expect(mixed).toMatchObject({ classification: "unallocated", affectedProductIds: ["product-a", "product-b"] });
    expect("trueCost" in mixed).toBe(false);
    expect(mixed.rawOrderFacts).toMatchObject({ merchandiseGross: money(1500), shippingCharged: money(25), taxAmount: money(150) });
    const unknown = evaluate({ items: [item({ productId: undefined })] });
    expect(unknown).toMatchObject({ classification: "unallocated", affectedProductIds: [] });
    expect(unknown.reasons).toContain("UNKNOWN_PRODUCT");
    expect("productId" in unknown).toBe(false);
  });

  it("keeps refund-policy Orders unallocated and cancelled Orders excluded with raw facts", () => {
    const refunded = evaluate({ order: order({ refundedAmount: money(1) }) });
    expect(refunded).toMatchObject({ classification: "unallocated" });
    expect(refunded.reasons).toContain("RETURN_OR_REFUND_POLICY_REQUIRED");
    expect("trueCost" in refunded).toBe(false);
    const cancelled = evaluate({ order: order({ status: "cancelled" }) });
    expect(cancelled).toMatchObject({ classification: "excluded", reasons: ["CANCELLED"] });
    expect(cancelled.rawOrderFacts).toMatchObject({ status: "cancelled", merchandiseGross: money(1000), taxAmount: money(150) });
    expect("trueCost" in cancelled).toBe(false);
  });

  it("preserves classifier facts and does not mutate canonical inputs", () => {
    const input = { scope, platform: "salla", order: order(), items: [item({ productId: undefined })], products: [product("product-a"), product("unrelated")], variants: [] as Variant[], rules: [rule()], allocations: [] as CostAllocation[], calculatedAt: "2026-09-21T00:00:00.000Z" };
    const before = structuredClone(input);
    const expected = classifyProductProfitabilityOrder(input);
    const result = evaluateProductProfitabilityOrder(input);
    expect(result.reasons).toEqual(expected.reasons);
    expect(result.affectedProductIds).toEqual(expected.affectedProductIds);
    expect(input).toEqual(before);
  });
});
