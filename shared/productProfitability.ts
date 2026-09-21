import type { MinorUnit } from "../server/domain/money";
import { calculateTrueCost, type FinancialStatus, type TrueCostInput, type TrueCostResult } from "../server/engines/trueCost";

export type CostDisplayStatus = FinancialStatus | "not_configured";
export type CostSource = "automatic" | "imported" | "manual" | "estimated" | "calculated" | "demo";

export interface MoneyView { minorUnits?: MinorUnit; display: string; unavailable: boolean; }
export interface CostComponentView { key: string; label: string; amount: MoneyView; status: CostDisplayStatus; source: CostSource; calculation: string; missing?: boolean; }
export interface ProductProfitabilityView {
  id: string; name: string; sku: string; inventory?: { stock: number; coverage: string; signal: string; tone: "good" | "warn" | "bad" };
  revenue: MoneyView; discounts: MoneyView; trueCost: MoneyView; grossProfit: MoneyView; trueProfit: MoneyView; margin: string;
  status: FinancialStatus; missingComponents: string[]; estimatedComponents: string[]; sources: CostSource[]; calculatedAt: string; version: string; components: CostComponentView[];
}
export interface ProductProfitabilityTransformationInput { result: TrueCostResult; product: Pick<ProductProfitabilityView, "id" | "name" | "sku" | "inventory">; }
export interface ProductProfitabilityCalculationInput { trueCost: TrueCostInput; product: Pick<ProductProfitabilityView, "id" | "name" | "sku" | "inventory">; }

const sar = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const presentMoney = (value?: MinorUnit): MoneyView => value === undefined ? { display: "Incomplete — not configured", unavailable: true } : { minorUnits: value, display: sar.format(value / 100), unavailable: false };
const source = (value: string): CostSource => value === "platform" ? "automatic" : value as CostSource;
export const productProfitabilityComponentNames: Array<[keyof Pick<TrueCostResult, "productCost" | "shipping" | "customs" | "packaging" | "paymentFees" | "advertisingAllocation" | "subscriptionAllocation" | "otherCosts">, string, string]> = [
  ["productCost", "Product cost", "Product cost"], ["shipping", "Shipping", "Shipping"], ["customs", "Customs / import", "Customs / import"], ["packaging", "Packaging", "Packaging"], ["paymentFees", "Payment fee", "Payment fees"], ["advertisingAllocation", "Advertising allocation", "Advertising allocation"], ["subscriptionAllocation", "Subscription allocation", "Subscription allocation"], ["otherCosts", "Other costs", "Other costs"],
];

export function adaptTrueCostResult(result: TrueCostResult, product: Pick<ProductProfitabilityView, "id" | "name" | "sku" | "inventory">): ProductProfitabilityView {
  const missing = new Set(result.missingComponents);
  const components = productProfitabilityComponentNames.map(([key, label, missingLabel]) => {
    const breakdown = result.breakdown.find((item) => item.category === ({ productCost: "product_cost", shipping: "shipping", customs: "customs", packaging: "packaging", paymentFees: "payment_fee", advertisingAllocation: "advertising", subscriptionAllocation: "subscription", otherCosts: "other" } as Record<string, string>)[key]);
    const missingComponent = missing.has(missingLabel);
    return { key, label, amount: presentMoney(missingComponent ? undefined : result[key]), status: (missingComponent ? "incomplete" : breakdown?.status ?? "not_configured") as CostDisplayStatus, source: source(breakdown?.source ?? "manual"), calculation: breakdown?.method ?? "not configured", missing: missingComponent };
  });
  return { ...product, revenue: presentMoney(result.revenue), discounts: presentMoney(result.discounts), trueCost: presentMoney(result.trueCost), grossProfit: presentMoney(result.grossProfit ?? undefined), trueProfit: presentMoney(result.trueProfit ?? undefined), margin: result.marginBps === null ? "—" : `${(result.marginBps / 100).toFixed(1)}%`, status: result.status, missingComponents: result.missingComponents, estimatedComponents: result.estimatedComponents, sources: Array.from(result.sources, source), calculatedAt: result.calculatedAt, version: result.version, components };
}

export function transformProductProfitability(inputs: readonly ProductProfitabilityTransformationInput[]): ProductProfitabilityView[] {
  return inputs.map(({ result, product }) => adaptTrueCostResult(result, product));
}

export function calculateProductProfitabilityDisplay(inputs: readonly ProductProfitabilityCalculationInput[]): ProductProfitabilityView[] {
  return transformProductProfitability(inputs.map(({ trueCost, product }) => ({ result: calculateTrueCost(trueCost), product })));
}
