import { describe, expect, it } from "vitest";
import { demoCostConfigurations, demoProductProfitability, presentMoney } from "../client/src/application/trueCostAdapter";

describe("True Cost frontend adapter", () => {
  it("preserves the Golden Fixture minor-unit values", () => { const product = demoProductProfitability()[0]; expect(product.revenue.minorUnits).toBe(9_500); expect(product.trueCost.minorUnits).toBe(5_225); expect(product.trueProfit.minorUnits).toBe(4_275); expect(product.status).toBe("estimated"); });
  it("keeps missing shipping incomplete instead of showing zero", () => { const product = demoProductProfitability().find((item) => item.id === "socks")!; expect(product.status).toBe("incomplete"); expect(product.components.find((item) => item.key === "shipping")?.amount.unavailable).toBe(true); });
  it("keeps unavailable money distinct from zero", () => { expect(presentMoney().unavailable).toBe(true); expect(presentMoney().display).not.toContain("0.00"); });
  it("keeps disabled rules out of active state", () => { expect(demoCostConfigurations().find((rule) => rule.id === "tabby")?.enabled).toBe(false); });
  it("labels the adapter dataset as demo", () => { expect(demoProductProfitability()[0].sources).toContain("demo"); });
});
