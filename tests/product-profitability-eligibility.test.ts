import { describe, expect, it } from "vitest";
import { money } from "../server/domain/money";
import type { CostAllocation, CostRule, Order, OrderItem, Product, Variant } from "../server/domain/commerce";
import { classifyProductProfitabilityOrder } from "../server/application/productProfitabilityEligibility";

const scope = { organizationId: "org", storeId: "store", mode: "live" as const };
const product = (id: string, status: "active" | "archived" = "active"): Product => ({ ...scope, id, source: "platform", name: id, status, createdAt: "2026-01-01" });
const variant = (id: string, productId: string): Variant => ({ ...scope, id, productId, source: "platform", name: id, status: "active", createdAt: "2026-01-01" });
const order = (overrides: Partial<Order> = {}): Order => ({ ...scope, id: "order", source: "platform", status: "paid", currency: "SAR", merchandiseGross: money(1000), discounts: money(0), shippingCharged: money(0), refundedAmount: money(0), revenueBasis: "tax_inclusive", orderedAt: "2026-01-15", ...overrides });
const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({ ...scope, id: "item", orderId: "order", productId: "product-a", source: "platform", title: "Item", quantity: 1, returnedQuantity: 0, unitGross: money(1000), discountAmount: money(0), ...overrides });
const rule = (overrides: Partial<CostRule> = {}): CostRule => ({ ...scope, id: "rule", category: "product_cost", scope: "product", targetId: "product-a", name: "Rule", calculation: "per_unit", amount: money(100), source: "manual", status: "actual", effectiveFrom: "2026-01-01", ...overrides });
const allocation = (overrides: Partial<CostAllocation> = {}): CostAllocation => ({ ...scope, id: "allocation", costRuleId: "rule", orderId: "order", amount: money(100), strategy: "manual", source: "manual", status: "actual", ...overrides });
const classify = (overrides: Partial<Parameters<typeof classifyProductProfitabilityOrder>[0]> = {}) => classifyProductProfitabilityOrder({ scope, platform: "salla", order: order(), items: [item()], products: [product("product-a")], variants: [], rules: [], allocations: [], ...overrides });
const expectReason = (result: ReturnType<typeof classifyProductProfitabilityOrder>, reason: string) => expect(result.reasons).toContain(reason);

describe("Product Profitability V1 Order Eligibility", () => {
  it("excludes cancelled orders", () => expect(classify({ order: order({ status: "cancelled" }) })).toMatchObject({ classification: "excluded", reasons: ["CANCELLED"] }));
  it("accepts paid and fulfilled direct single-product orders even without configured costs", () => {
    expect(classify()).toMatchObject({ classification: "eligible", attributedProductId: "product-a" });
    expect(classify({ order: order({ status: "fulfilled" }) })).toMatchObject({ classification: "eligible" });
  });
  it("rejects missing, mismatched, unknown, and mixed product identity without expanding affected products", () => {
    expectReason(classify({ items: [] }), "NO_ORDER_ITEMS");
    expectReason(classify({ items: [item({ orderId: "other" })] }), "SCOPE_OR_ORDER_MISMATCH");
    expectReason(classify({ items: [item({ storeId: "other" })] }), "SCOPE_OR_ORDER_MISMATCH");
    expect(classify({ items: [item({ productId: undefined })] })).toMatchObject({ classification: "unallocated", affectedProductIds: [] });
    expectReason(classify({ items: [item({ productId: undefined })] }), "UNKNOWN_PRODUCT");
    const second = item({ id: "item-2", productId: "product-b", unitGross: money(500) });
    expectReason(classify({ order: order({ merchandiseGross: money(1500) }), items: [item(), second], products: [product("product-a"), product("product-b")] }), "MULTIPLE_PRODUCTS");
    const knownAndUnknown = classify({ items: [item(), item({ id: "unknown", productId: undefined, unitGross: money(0) })] });
    expect(knownAndUnknown).toMatchObject({ affectedProductIds: ["product-a"] });
    expectReason(knownAndUnknown, "UNKNOWN_PRODUCT");
  });
  it("validates variants and permits safe multiple lines or variants of one product", () => {
    expect(classify({ items: [item(), item({ id: "two", unitGross: money(1000) })], order: order({ merchandiseGross: money(2000) }) })).toMatchObject({ classification: "eligible" });
    expectReason(classify({ items: [item({ variantId: "missing" })] }), "INVALID_VARIANT_RELATIONSHIP");
    const mismatchedVariant = classify({ items: [item({ variantId: "variant-b" })], variants: [variant("variant-b", "product-b")] });
    expect(mismatchedVariant).toMatchObject({ affectedProductIds: ["product-a"] });
    expectReason(mismatchedVariant, "INVALID_VARIANT_RELATIONSHIP");
    const variants = [variant("m", "product-a"), variant("l", "product-a")];
    const multiVariant = { items: [item({ variantId: "m", unitGross: money(500) }), item({ id: "l", variantId: "l", unitGross: money(500) })], order: order({ merchandiseGross: money(1000) }), variants };
    expect(classify(multiVariant)).toMatchObject({ classification: "eligible" });
    expectReason(classify({ ...multiVariant, rules: [rule({ scope: "variant", targetId: "m" })] }), "UNSAFE_VARIANT_RULE_COMBINATION");
  });
  it("rejects reconciliation, money, return/refund, currency, basis, and unsupported statuses", () => {
    expectReason(classify({ order: order({ merchandiseGross: money(999) }) }), "MERCHANDISE_RECONCILIATION_FAILED");
    expectReason(classify({ items: [item({ quantity: 0 })] }), "INVALID_QUANTITY_OR_MONEY");
    const returnResult = classify({ items: [item({ returnedQuantity: 2 })] });
    expectReason(returnResult, "INVALID_QUANTITY_OR_MONEY");
    expectReason(returnResult, "RETURN_OR_REFUND_POLICY_REQUIRED");
    expectReason(classify({ order: order({ refundedAmount: money(1) }) }), "RETURN_OR_REFUND_POLICY_REQUIRED");
    for (const status of ["refunded", "partially_refunded", "returned"] as const) expectReason(classify({ order: order({ status }) }), "RETURN_OR_REFUND_POLICY_REQUIRED");
    expectReason(classify({ order: order({ currency: "USD" }) }), "UNSUPPORTED_CURRENCY");
    expectReason(classify({ order: order({ revenueBasis: "unknown" }) }), "UNSUPPORTED_REVENUE_BASIS");
    expectReason(classify({ order: order({ status: "pending" }) }), "UNSUPPORTED_ORDER_STATUS");
  });
  it("rejects ambiguous candidate rules and allocations without assigning precedence", () => {
    expectReason(classify({ rules: [rule(), rule({ id: "rule-2" })] }), "AMBIGUOUS_COST_RULES");
    expectReason(classify({ rules: [rule()], allocations: [allocation()] }), "ALLOCATION_RULE_AMBIGUITY");
    expectReason(classify({ allocations: [allocation()] }), "ALLOCATION_RULE_AMBIGUITY");
    expectReason(classify({ rules: [rule({ status: "not_configured" })], allocations: [allocation()] }), "ALLOCATION_RULE_AMBIGUITY");
    expectReason(classify({ rules: [rule({ effectiveFrom: "2027-01-01" })], allocations: [allocation()] }), "ALLOCATION_RULE_AMBIGUITY");
    expect(classify({ rules: [rule({ scope: "campaign" })], allocations: [allocation()] })).toMatchObject({ classification: "eligible" });
    expectReason(classify({ rules: [rule({ scope: "campaign" })], allocations: [allocation(), allocation({ id: "two" })] }), "ALLOCATION_RULE_AMBIGUITY");
  });
  it("allows archived product history and never marks unrelated products affected", () => expect(classify({ products: [product("product-a", "archived"), product("unrelated")] })).toMatchObject({ classification: "eligible", affectedProductIds: ["product-a"] }));
});
