import { describe, expect, it } from "vitest";
import { demoCostConfigurations, demoProductProfitability, presentMoney } from "../client/src/application/trueCostAdapter";
import { calculateTrueCost } from "../server/engines/trueCost";
import { money } from "../server/domain/money";
import { coreRules, items, order } from "./fixtures/true-cost-fixtures";

describe("True Cost frontend adapter", () => {
  it("preserves the Golden Fixture minor-unit values", () => { const product = demoProductProfitability()[0]; expect(product.revenue.minorUnits).toBe(9_500); expect(product.trueCost.minorUnits).toBe(5_225); expect(product.trueProfit.minorUnits).toBe(4_275); expect(product.status).toBe("estimated"); });
  it("keeps missing shipping incomplete instead of showing zero", () => { const product = demoProductProfitability().find((item) => item.id === "socks")!; expect(product.status).toBe("incomplete"); expect(product.components.find((item) => item.key === "shipping")?.amount.unavailable).toBe(true); });
  it("keeps unavailable money distinct from zero", () => { expect(presentMoney().unavailable).toBe(true); expect(presentMoney().display).not.toContain("0.00"); });
  it("formats minor units without mutating the underlying value", () => { const minorUnits = money(9_500); const view = presentMoney(minorUnits); expect(view.minorUnits).toBe(9_500); expect(minorUnits).toBe(9_500); });
  it("keeps disabled rules out of active state", () => { expect(demoCostConfigurations().find((rule) => rule.id === "tabby")?.enabled).toBe(false); });
  it("labels the adapter dataset as demo", () => { expect(demoProductProfitability()[0].sources).toContain("demo"); });
  it("preserves the OLD product display scope without inventing missing True Cost data", () => { const products = demoProductProfitability(); expect(products).toHaveLength(4); expect(products.find((product) => product.id === "burgundy")?.status).toBe("no_data"); expect(products.find((product) => product.id === "burgundy")?.trueProfit.display).toBe("No data"); });
  it("maps a complete actual profitability result", () => { const rules = coreRules.map((rule) => rule.category === "packaging" ? { ...rule, status: "actual" as const } : rule); expect(calculateTrueCost({ order, items, rules, calculatedAt: "2026-02-01" }).status).toBe("actual"); });
  it("marks missing product cost incomplete", () => { expect(calculateTrueCost({ order, items, rules: coreRules.filter((rule) => rule.category !== "product_cost"), calculatedAt: "2026-02-01" }).status).toBe("incomplete"); });
  it("marks missing payment fee incomplete", () => { expect(calculateTrueCost({ order, items, rules: coreRules.filter((rule) => rule.category !== "payment_fee"), calculatedAt: "2026-02-01" }).status).toBe("incomplete"); });
  it("keeps no-data results distinct", () => { expect(calculateTrueCost({ order: { ...order, status: "cancelled" }, items, rules: coreRules, calculatedAt: "2026-02-01" }).status).toBe("no_data"); });
});
