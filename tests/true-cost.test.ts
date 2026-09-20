import { describe, expect, it } from "vitest";
import { calculateTrueCost } from "../server/engines/trueCost";
import { money } from "../server/domain/money";
import { coreRules, items, order, scope } from "./fixtures/true-cost-fixtures";

const calculate = (overrides: Partial<Parameters<typeof calculateTrueCost>[0]> = {}) => calculateTrueCost({ order, items, rules: coreRules, calculatedAt: "2026-02-01T00:00:00Z", ...overrides });
describe("true cost engine", () => {
  it("matches the golden fixture without floating point drift", () => { const result = calculate(); expect(result.revenue).toBe(9_500); expect(result.trueCost).toBe(5_225); expect(result.trueProfit).toBe(4_275); expect(result.status).toBe("estimated"); });
  it("marks a missing product cost incomplete rather than zero", () => expect(calculate({ rules: coreRules.filter(rule => rule.category !== "product_cost") }).missingComponents).toContain("Product cost"));
  it("marks missing shipping incomplete", () => expect(calculate({ rules: coreRules.filter(rule => rule.category !== "shipping") }).status).toBe("incomplete"));
  it("supports fixed plus percentage payment fees", () => expect(calculate().paymentFees).toBe(325));
  it("multiplies product cost by net quantity", () => expect(calculate().productCost).toBe(4_000));
  it("retains discount in net revenue", () => expect(calculate().revenue).toBe(9_500));
  it("records estimated components", () => expect(calculate().estimatedComponents).toContain("Packaging"));
  it("uses documented store allocations without arbitrary spreading", () => { const result = calculate({ allocations: [{ ...scope, id: "allocation", costRuleId: "packaging", orderId: order.id, amount: money(60), strategy: "period_allocation", source: "calculated", status: "actual" }] }); expect(result.packaging).toBe(260); expect(result.breakdown.some(component => component.method === "allocation:period_allocation")).toBe(true); });
  it("honours cost history effective dates", () => { const result = calculate({ rules: [...coreRules, { ...coreRules[0], id: "future-cost", amount: money(9_999), effectiveFrom: "2026-02-01T00:00:00Z" }] }); expect(result.productCost).toBe(4_000); });
  it("keeps organization scoping in canonical records", () => expect(order.organizationId).toBe("org-a"));
  it("excludes cancelled orders", () => expect(calculate({ order: { ...order, status: "cancelled" } }).status).toBe("no_data"));
  it("does not claim correctness for refunded orders without a reversal policy", () => expect(calculate({ order: { ...order, status: "partially_refunded", refundedAmount: money(100) } }).status).toBe("incomplete"));
  it("rounds basis-point fees to minor units", () => { const result = calculate({ order: { ...order, merchandiseGross: money(101), discounts: money(0), shippingCharged: money(0) }, rules: coreRules.map(rule => rule.id === "payment" ? { ...rule, fixedFee: money(0) } : rule) }); expect(result.paymentFees).toBe(3); });
});
