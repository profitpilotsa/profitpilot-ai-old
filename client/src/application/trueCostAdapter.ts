import { money, type MinorUnit } from "../../../server/domain/money";
import type { CostCategory, CostRule, Order, OrderItem } from "../../../server/domain/commerce";
import { calculateProductProfitabilityDisplay, presentMoney, productProfitabilityComponentNames, type CostDisplayStatus, type CostSource, type MoneyView, type ProductProfitabilityCalculationInput, type ProductProfitabilityView } from "@shared/productProfitability";

export { adaptTrueCostResult, calculateProductProfitabilityDisplay, presentMoney, productProfitabilityComponentNames, transformProductProfitability, type CostComponentView, type CostDisplayStatus, type CostSource, type MoneyView, type ProductProfitabilityCalculationInput, type ProductProfitabilityTransformationInput, type ProductProfitabilityView } from "@shared/productProfitability";
export type CostRecurrence = "one_time" | "per_order" | "per_unit" | "daily" | "weekly" | "monthly" | "yearly" | "period_allocation";
export interface CostConfigurationView {
  id: string; category: CostCategory; name: string; scope: "store" | "product" | "variant" | "order" | "campaign";
  calculation: "fixed" | "per_order" | "per_product" | "per_unit" | "percentage" | "imported" | "calculated";
  recurrence: CostRecurrence; source: CostSource; status: CostDisplayStatus; enabled: boolean; effectiveFrom: string; amount: MoneyView; percentageBps?: number; fixedFee?: MoneyView; notes?: string;
}


interface ProductProfitabilityDemoSource {
  calculationInputs: readonly ProductProfitabilityCalculationInput[];
  unavailableProduct: ProductProfitabilityView;
}

const scope = { organizationId: "demo-profitpilot", storeId: "demo-store", mode: "demo" as const };
const asRule = (id: string, category: CostCategory, values: Partial<CostRule>): CostRule => ({ ...scope, id, category, scope: "store", name: id, calculation: "fixed", source: "demo", status: "actual", effectiveFrom: "2026-01-01T00:00:00Z", ...values });
const baseRules: CostRule[] = [
  asRule("product-pima", "product_cost", { scope: "variant", targetId: "pima-black-m", calculation: "per_unit", amount: money(4200), source: "imported" }),
  asRule("shipping", "shipping", { scope: "order", amount: money(1800), calculation: "fixed", source: "imported" }),
  asRule("mada", "payment_fee", { scope: "order", calculation: "percentage", percentageBps: 250, fixedFee: money(100), source: "calculated" }),
  asRule("packaging", "packaging", { calculation: "per_order", amount: money(300), source: "manual", status: "estimated" }),
  asRule("ads", "advertising", { calculation: "per_order", amount: money(1200), source: "estimated", status: "estimated" }),
  asRule("subscription", "subscription", { calculation: "per_order", amount: money(180), source: "calculated" }),
];
const goldenRules: CostRule[] = [
  asRule("golden-product", "product_cost", { scope: "variant", targetId: "pima-black-m", calculation: "per_unit", amount: money(2000), source: "imported" }),
  asRule("golden-shipping", "shipping", { scope: "order", calculation: "fixed", amount: money(700), source: "imported" }),
  asRule("golden-payment", "payment_fee", { scope: "order", calculation: "percentage", percentageBps: 250, fixedFee: money(100), source: "calculated" }),
  asRule("golden-packaging", "packaging", { calculation: "per_order", amount: money(200), source: "manual", status: "estimated" }),
];
const goldenOrder: Order = { ...scope, id: "order-golden", source: "demo", status: "paid", currency: "SAR", merchandiseGross: money(10000), discounts: money(1000), shippingCharged: money(500), refundedAmount: money(0), revenueBasis: "tax_inclusive", orderedAt: "2026-01-15T00:00:00Z" };
const goldenItems: OrderItem[] = [{ ...scope, id: "line-golden", orderId: goldenOrder.id, productId: "pima", variantId: "pima-black-m", source: "demo", title: "IRONCLAD Pima T-Shirt", quantity: 2, returnedQuantity: 0, unitGross: money(5000), discountAmount: money(1000) }];

function demoProductProfitabilitySource(): ProductProfitabilityDemoSource {
  const noData = (): MoneyView => ({ display: "No data", unavailable: true });
  const unavailableProduct: ProductProfitabilityView = {
    id: "burgundy", name: "Burgundy Overshirt", sku: "BRG-008", inventory: { stock: 490, coverage: "61 days", signal: "No True Cost data", tone: "warn" },
    revenue: noData(), discounts: noData(), trueCost: noData(), grossProfit: noData(), trueProfit: noData(), margin: "—", status: "no_data", missingComponents: ["No engine-backed order or cost data"], estimatedComponents: [], sources: ["demo"], calculatedAt: "2026-02-01T00:00:00Z", version: "2A.1-demo",
    components: productProfitabilityComponentNames.map(([key, label]) => ({ key, label, amount: noData(), status: "no_data", source: "demo", calculation: "not configured", missing: true })),
  };
  return { unavailableProduct, calculationInputs: [
    { trueCost: { order: goldenOrder, items: goldenItems, rules: goldenRules, calculatedAt: "2026-02-01T00:00:00Z", version: "2A.1-demo" }, product: { id: "pima", name: "IRONCLAD Pima T-Shirt", sku: "PMA-001", inventory: { stock: 85, coverage: "10 days", signal: "At risk", tone: "bad" } } },
    { trueCost: { order: { ...goldenOrder, id: "order-spandex", merchandiseGross: money(19600), discounts: money(800), shippingCharged: money(800) }, items: [{ ...goldenItems[0], id: "line-spandex", orderId: "order-spandex", productId: "spandex", variantId: "spandex-black-m", title: "IRONCLAD Spandex T-Shirt", quantity: 4 }], rules: baseRules.map((rule) => rule.id === "product-pima" ? { ...rule, id: "product-spandex", targetId: "spandex-black-m", amount: money(3100) } : rule), calculatedAt: "2026-02-01T00:00:00Z", version: "2A.1-demo" }, product: { id: "spandex", name: "IRONCLAD Spandex T-Shirt", sku: "SPX-014", inventory: { stock: 142, coverage: "24 days", signal: "Margin down", tone: "warn" } } },
    { trueCost: { order: { ...goldenOrder, id: "order-socks", merchandiseGross: money(9480), discounts: money(0), shippingCharged: money(0) }, items: [{ ...goldenItems[0], id: "line-socks", orderId: "order-socks", productId: "socks", variantId: "socks-set", title: "Studio Socks Set", quantity: 3 }], rules: baseRules.filter((rule) => rule.category !== "shipping").map((rule) => rule.id === "product-pima" ? { ...rule, id: "product-socks", targetId: "socks-set", amount: money(700) } : rule), calculatedAt: "2026-02-01T00:00:00Z", version: "2A.1-demo" }, product: { id: "socks", name: "Studio Socks Set", sku: "STS-022", inventory: { stock: 210, coverage: "37 days", signal: "Incomplete cost data", tone: "warn" } } },
  ] };
}

export function demoProductProfitability(): ProductProfitabilityView[] {
  const { calculationInputs, unavailableProduct } = demoProductProfitabilitySource();
  const calculatedProducts = calculateProductProfitabilityDisplay(calculationInputs);
  return [calculatedProducts[0], calculatedProducts[1], unavailableProduct, calculatedProducts[2]];
}

/** UI-facing read boundary; live data can replace the demo implementation later. */
export function getProductProfitabilityDisplay(): ProductProfitabilityView[] {
  return demoProductProfitability();
}

export function demoCostConfigurations(): CostConfigurationView[] {
  const configs: Array<Omit<CostConfigurationView, "amount" | "fixedFee"> & { amount?: MinorUnit; fixedFee?: MinorUnit }> = [
    { id: "product-pima", category: "product_cost", name: "Pima / Black M", scope: "variant", calculation: "per_unit", recurrence: "per_unit", source: "imported", status: "actual", enabled: true, effectiveFrom: "2026-01-01", amount: money(4200) },
    { id: "packaging", category: "packaging", name: "Standard Box", scope: "store", calculation: "per_order", recurrence: "per_order", source: "manual", status: "estimated", enabled: true, effectiveFrom: "2026-01-01", amount: money(300) },
    { id: "mada", category: "payment_fee", name: "Mada", scope: "order", calculation: "percentage", recurrence: "per_order", source: "calculated", status: "actual", enabled: true, effectiveFrom: "2026-01-01", fixedFee: money(0), percentageBps: 250 },
    { id: "visa", category: "payment_fee", name: "Visa / Mastercard", scope: "order", calculation: "percentage", recurrence: "per_order", source: "calculated", status: "actual", enabled: true, effectiveFrom: "2026-01-01", fixedFee: money(100), percentageBps: 290 },
    { id: "tamara", category: "payment_fee", name: "Tamara", scope: "order", calculation: "percentage", recurrence: "per_order", source: "manual", status: "not_configured", enabled: true, effectiveFrom: "2026-01-01" },
    { id: "tabby", category: "payment_fee", name: "Tabby", scope: "order", calculation: "percentage", recurrence: "per_order", source: "manual", status: "not_configured", enabled: false, effectiveFrom: "2026-01-01" },
    { id: "shipping", category: "shipping", name: "Supplier shipping", scope: "order", calculation: "imported", recurrence: "per_order", source: "imported", status: "actual", enabled: true, effectiveFrom: "2026-01-01", amount: money(1800) },
    { id: "customs", category: "customs", name: "Import allocation", scope: "product", calculation: "calculated", recurrence: "period_allocation", source: "estimated", status: "incomplete", enabled: true, effectiveFrom: "2026-01-01" },
    { id: "ads", category: "advertising", name: "Meta Ads allocation", scope: "campaign", calculation: "per_order", recurrence: "period_allocation", source: "estimated", status: "estimated", enabled: true, effectiveFrom: "2026-01-01", amount: money(1200) },
    { id: "subscription", category: "subscription", name: "Store platform", scope: "store", calculation: "per_order", recurrence: "monthly", source: "calculated", status: "actual", enabled: true, effectiveFrom: "2026-01-01", amount: money(180) },
    { id: "other", category: "other", name: "Warehouse allocation", scope: "store", calculation: "fixed", recurrence: "monthly", source: "manual", status: "not_configured", enabled: false, effectiveFrom: "2026-01-01" },
  ];
  return configs.map(({ amount, fixedFee, ...config }) => ({ ...config, amount: presentMoney(amount), fixedFee: presentMoney(fixedFee) }));
}
