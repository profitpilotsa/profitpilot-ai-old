import { describe, expect, it } from "vitest";
import { money } from "../server/domain/money";
import { calculateCashAwareDecision, calculateReorderRecommendation, calculateSalesVelocity, calculateStockCoverage } from "../server/engines/inventory";
import { adaptOrderDisplay } from "../client/src/application/inventoryAdapter";

const scope = { organizationId: "org-a", storeId: "store-a", mode: "demo" as const };
const pima = () => calculateReorderRecommendation({ scope, productId: "pima", variantId: "pima-black-m", inventory: { ...scope, id: "inventory", productId: "pima", variantId: "pima-black-m", currentStock: 85, availableStock: 85, source: "demo", status: "estimated", observedAt: "2026-09-19T00:00:00Z" }, sales: { ...scope, productId: "pima", variantId: "pima-black-m", unitsSold: 255, periodDays: 30, source: "demo", status: "estimated" }, supplierProduct: { ...scope, id: "supplier-product", supplierId: "supplier-x", productId: "pima", variantId: "pima-black-m", unitCost: money(3200), currency: "SAR", leadTimeDays: 15, moq: 200, source: "demo", status: "estimated" }, configuration: { ...scope, productId: "pima", variantId: "pima-black-m", safetyStock: 50, reviewPeriodDays: 9, source: "demo", status: "estimated" }, calculatedAt: "2026-09-19T00:00:00Z", source: "demo" });

describe("inventory and cash-aware engines", () => {
  it("calculates deterministic sales velocity and stock coverage", () => { const velocity = calculateSalesVelocity({ ...scope, productId: "pima", unitsSold: 255, periodDays: 30, source: "demo", status: "estimated" }); expect(velocity.value).toBe(8.5); expect(calculateStockCoverage(85, velocity).value).toBe(10); });
  it("keeps zero velocity and invalid sales inputs out of coverage", () => {
    const zeroVelocity = calculateSalesVelocity({ ...scope, productId: "pima", unitsSold: 0, periodDays: 30, source: "demo", status: "actual" });
    expect(zeroVelocity.value).toBe(0);
    expect(calculateStockCoverage(85, zeroVelocity).value).toBeUndefined();
    for (const sales of [{ unitsSold: 1, periodDays: 0 }, { unitsSold: 1, periodDays: -1 }, { unitsSold: -1, periodDays: 30 }]) {
      const result = calculateSalesVelocity({ ...scope, productId: "pima", ...sales, source: "demo", status: "actual" });
      expect(result.status).toBe("incomplete"); expect(result.value).toBeUndefined();
    }
  });
  it("creates an explainable reorder recommendation with MOQ", () => { const result = pima(); expect(result.reorderPoint).toBe(178); expect(result.reorderQuantity).toBe(200); expect(result.reorderCost).toBe(640_000); expect(result.coverageDays).toBe(10); expect(result.estimatedStockoutAt).toContain("2026-09-29"); });
  it("uses MOQ as a minimum rather than a case-pack multiple", () => {
    const result = calculateReorderRecommendation({ scope, productId: "minimum-only", inventory: { ...scope, id: "inventory", productId: "minimum-only", currentStock: 0, source: "demo", status: "actual", observedAt: "2026-09-19T00:00:00Z" }, sales: { ...scope, productId: "minimum-only", unitsSold: 3, periodDays: 1, source: "demo", status: "actual" }, supplierProduct: { ...scope, id: "supply", supplierId: "supplier-x", productId: "minimum-only", currency: "SAR", unitCost: money(100), leadTimeDays: 5, moq: 20, source: "demo", status: "actual" }, configuration: { ...scope, productId: "minimum-only", safetyStock: 0, reviewPeriodDays: 4, source: "demo", status: "actual" }, calculatedAt: "2026-09-19T00:00:00Z" });
    expect(result.reorderQuantity).toBe(27);
    expect(result.explanations.join(" ")).toContain("not treated as a case-pack multiple");
  });
  it("propagates invalid inventory and supplier values as incomplete", () => {
    const invalidStock = calculateStockCoverage(-1, { value: 2, status: "actual", missingInputs: [] });
    expect(invalidStock.status).toBe("incomplete"); expect(invalidStock.value).toBeUndefined();
    const invalidLead = calculateReorderRecommendation({ scope, productId: "pima", inventory: { ...scope, id: "inventory", productId: "pima", currentStock: 10, source: "demo", status: "actual", observedAt: "2026-09-19T00:00:00Z" }, sales: { ...scope, productId: "pima", unitsSold: 10, periodDays: 1, source: "demo", status: "actual" }, supplierProduct: { ...scope, id: "supply", supplierId: "supplier-x", productId: "pima", currency: "SAR", unitCost: money(100), leadTimeDays: -1, source: "demo", status: "actual" }, calculatedAt: "2026-09-19T00:00:00Z" });
    expect(invalidLead.status).toBe("incomplete"); expect(invalidLead.reorderQuantity).toBeUndefined();
  });
  it("does not invent a recommendation when velocity is missing", () => { const result = calculateReorderRecommendation({ scope, productId: "unknown", inventory: { ...scope, id: "inventory", productId: "unknown", currentStock: 12, source: "demo", status: "actual", observedAt: "2026-09-19T00:00:00Z" }, calculatedAt: "2026-09-19T00:00:00Z" }); expect(result.reorderQuantity).toBeUndefined(); expect(result.status).toBe("incomplete"); });
  it("exposes a missing lead time instead of assuming one", () => { const result = pima(); const missingLead = calculateReorderRecommendation({ scope, productId: "pima", inventory: { ...scope, id: "inventory", productId: "pima", currentStock: 85, source: "demo", status: "actual", observedAt: "2026-09-19T00:00:00Z" }, sales: { ...scope, productId: "pima", unitsSold: 255, periodDays: 30, source: "demo", status: "actual" }, supplierProduct: { ...scope, id: "supply", supplierId: "supplier-x", productId: "pima", currency: "SAR", unitCost: money(3200), source: "demo", status: "incomplete" }, calculatedAt: "2026-09-19T00:00:00Z" }); expect(result.reorderQuantity).toBeUndefined(); expect(missingLead.missingInputs).toContain("Supplier lead time is not configured"); });
  it("marks reorder cost incomplete when supplier cost is missing", () => { const missingCost = calculateReorderRecommendation({ scope, productId: "pima", inventory: { ...scope, id: "inventory", productId: "pima", currentStock: 85, source: "demo", status: "actual", observedAt: "2026-09-19T00:00:00Z" }, sales: { ...scope, productId: "pima", unitsSold: 255, periodDays: 30, source: "demo", status: "actual" }, supplierProduct: { ...scope, id: "supply", supplierId: "supplier-x", productId: "pima", currency: "SAR", leadTimeDays: 15, source: "demo", status: "incomplete" }, calculatedAt: "2026-09-19T00:00:00Z" }); expect(missingCost.reorderCost).toBeUndefined(); expect(missingCost.missingInputs).toContain("Supplier unit cost is not configured"); });
  it("projects cash using only known obligations", () => { const decision = calculateCashAwareDecision({ id: "decision", lifecycle: "approval_required", recommendation: pima(), cash: { ...scope, currentCash: money(2_500_000), knownImmediateObligations: money(800_000), cashFloor: money(2_000_000), currency: "SAR", source: "demo", status: "estimated", observedAt: "2026-09-19T00:00:00Z" }, calculatedAt: "2026-09-19T00:00:00Z" }); expect(decision.projectedCash).toBe(1_060_000); expect(decision.cashFloorStatus).toBe("configured"); });
  it("keeps cash incomplete when current cash is missing", () => { const decision = calculateCashAwareDecision({ id: "decision", lifecycle: "detected", recommendation: pima(), cash: { ...scope, currency: "SAR", source: "demo", status: "incomplete", observedAt: "2026-09-19T00:00:00Z" }, calculatedAt: "2026-09-19T00:00:00Z" }); expect(decision.projectedCash).toBeUndefined(); expect(decision.missingInputs).toContain("Current cash is not configured"); });
  it("does not invent obligations and preserves a negative cash projection", () => {
    const decision = calculateCashAwareDecision({ id: "decision", lifecycle: "detected", recommendation: pima(), cash: { ...scope, currentCash: money(100), currency: "SAR", source: "demo", status: "actual", observedAt: "2026-09-19T00:00:00Z" }, calculatedAt: "2026-09-19T00:00:00Z" });
    expect(decision.obligationsStatus).toBe("none_known"); expect(decision.knownImmediateObligations).toBeUndefined(); expect(decision.projectedCash).toBe(-639_900);
  });
  it("marks a currency mismatch as incomplete instead of comparing incompatible money", () => {
    const decision = calculateCashAwareDecision({ id: "decision", lifecycle: "detected", recommendation: pima(), cash: { ...scope, currentCash: money(2_500_000), currency: "USD", source: "demo", status: "actual", observedAt: "2026-09-19T00:00:00Z" }, calculatedAt: "2026-09-19T00:00:00Z" });
    expect(decision.projectedCash).toBeUndefined(); expect(decision.missingInputs).toContain("Cash and supplier currencies do not match");
  });
  it("does not present cancelled or reversal orders as final profitability", () => {
    const common = { ...scope, id: "order", source: "demo" as const, currency: "SAR", merchandiseGross: money(1000), discounts: money(0), shippingCharged: money(0), refundedAmount: money(0), revenueBasis: "tax_inclusive" as const, orderedAt: "2026-09-19T00:00:00Z" };
    expect(adaptOrderDisplay({ ...common, status: "cancelled" }, []).trueProfitStatus).toBe("no_data");
    expect(adaptOrderDisplay({ ...common, status: "refunded" }, []).trueProfitStatus).toBe("incomplete");
    expect(adaptOrderDisplay({ ...common, status: "partially_refunded" }, []).trueCostStatus).toBe("incomplete");
    expect(adaptOrderDisplay({ ...common, status: "returned" }, []).trueCostStatus).toBe("incomplete");
  });
  it("preserves money minor units and tenant scope", () => { const unitCost = money(3200); const result = pima(); expect(unitCost).toBe(3200); expect(result.organizationId).toBe("org-a"); expect(result.storeId).toBe("store-a"); });
});
