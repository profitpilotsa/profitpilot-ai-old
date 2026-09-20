import { addMoney, applyBps, money, subtractMoney, zeroMoney, type MinorUnit } from "../domain/money";
import type { CostAllocation, CostCategory, CostRule, Order, OrderItem } from "../domain/commerce";

export type FinancialStatus = "actual" | "estimated" | "incomplete" | "no_data";
export interface Component { category: CostCategory | "revenue" | "discounts"; amount: MinorUnit; source: string; status: FinancialStatus; method: string; ruleId?: string; }
export interface TrueCostInput { order: Order; items: OrderItem[]; rules: CostRule[]; allocations?: CostAllocation[]; calculatedAt: string; version?: string; }
export interface TrueCostResult {
  status: FinancialStatus; missingComponents: string[]; estimatedComponents: string[]; sources: string[];
  revenue: MinorUnit; discounts: MinorUnit; productCost: MinorUnit; shipping: MinorUnit; customs: MinorUnit; packaging: MinorUnit;
  paymentFees: MinorUnit; advertisingAllocation: MinorUnit; subscriptionAllocation: MinorUnit; otherCosts: MinorUnit;
  trueCost: MinorUnit; grossProfit: MinorUnit | null; trueProfit: MinorUnit | null; marginBps: number | null;
  breakdown: Component[]; calculatedAt: string; version: string; handling: { cancelled: "excluded" | "not_applicable"; refunds: "none" | "requires_policy" };
}

const isEffective = (rule: CostRule, at: string) => rule.effectiveFrom <= at && (!rule.effectiveTo || rule.effectiveTo > at) && rule.status !== "not_configured";
const categoryLabel: Record<CostCategory, string> = { product_cost: "Product cost", shipping: "Shipping", customs: "Customs / import", packaging: "Packaging", payment_fee: "Payment fees", advertising: "Advertising allocation", subscription: "Subscription allocation", other: "Other costs" };
const categoryStatus = (rule: CostRule): FinancialStatus => rule.status === "actual" ? "actual" : rule.status === "estimated" ? "estimated" : "incomplete";

function evaluate(rule: CostRule, order: Order, items: OrderItem[]): MinorUnit | undefined {
  const units = items.reduce((sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity), 0);
  const products = new Set(items.map(item => item.productId).filter(Boolean)).size;
  const netMerchandise = subtractMoney(order.merchandiseGross, order.discounts);
  if (rule.calculation === "fixed" || rule.calculation === "imported" || rule.calculation === "calculated") return rule.amount;
  if (rule.calculation === "per_order") return rule.amount;
  if (rule.calculation === "per_unit") return rule.amount === undefined ? undefined : money(rule.amount * units);
  if (rule.calculation === "per_product") return rule.amount === undefined ? undefined : money(rule.amount * products);
  if (rule.calculation === "percentage") return rule.percentageBps === undefined ? undefined : addMoney(applyBps(netMerchandise, rule.percentageBps), rule.fixedFee ?? zeroMoney);
  return undefined;
}

export function calculateTrueCost(input: TrueCostInput): TrueCostResult {
  const { order, items } = input;
  if (order.status === "cancelled") return empty(order, input, "excluded");
  const revenue = subtractMoney(addMoney(order.merchandiseGross, order.shippingCharged), addMoney(order.discounts, order.refundedAmount));
  const breakdown: Component[] = [
    { category: "revenue", amount: revenue, source: order.source, status: order.source === "estimated" || order.source === "demo" ? "estimated" : "actual", method: `net ${order.revenueBasis} revenue` },
    { category: "discounts", amount: order.discounts, source: order.source, status: "actual", method: "order discount" },
  ];
  const missing = new Set<string>(); const estimated = new Set<string>(); const sources = new Set<string>([order.source]);
  const totals: Record<CostCategory, MinorUnit> = { product_cost: zeroMoney, shipping: zeroMoney, customs: zeroMoney, packaging: zeroMoney, payment_fee: zeroMoney, advertising: zeroMoney, subscription: zeroMoney, other: zeroMoney };
  const rules = input.rules.filter(rule => isEffective(rule, order.orderedAt));
  const essential = new Set<CostCategory>(["product_cost", "shipping", "payment_fee"]);
  for (const category of Object.keys(totals) as CostCategory[]) {
    const candidates = rules.filter(rule => rule.category === category && (rule.scope === "store" || rule.scope === "order" || (rule.scope === "product" && items.some(item => item.productId === rule.targetId)) || (rule.scope === "variant" && items.some(item => item.variantId === rule.targetId))));
    const allocations = (input.allocations ?? []).filter(a => a.orderId === order.id && rules.some(rule => rule.id === a.costRuleId && rule.category === category));
    if (candidates.length === 0 && allocations.length === 0) { if (essential.has(category)) missing.add(categoryLabel[category]); continue; }
    for (const rule of candidates) {
      const amount = evaluate(rule, order, items);
      if (amount === undefined || rule.status === "incomplete") { missing.add(categoryLabel[category]); continue; }
      const status = categoryStatus(rule); if (status === "estimated") estimated.add(categoryLabel[category]); if (status === "incomplete") missing.add(categoryLabel[category]);
      totals[category] = addMoney(totals[category], amount); sources.add(rule.source);
      breakdown.push({ category, amount, source: rule.source, status, method: rule.calculation, ruleId: rule.id });
    }
    for (const allocation of allocations) {
      const status: FinancialStatus = allocation.status === "actual" ? "actual" : allocation.status === "estimated" ? "estimated" : "incomplete";
      if (status === "estimated") estimated.add(categoryLabel[category]); if (status === "incomplete") missing.add(categoryLabel[category]);
      totals[category] = addMoney(totals[category], allocation.amount); sources.add(allocation.source);
      breakdown.push({ category, amount: allocation.amount, source: allocation.source, status, method: `allocation:${allocation.strategy}`, ruleId: allocation.costRuleId });
    }
  }
  if (items.some(item => item.quantity <= 0 || item.returnedQuantity > item.quantity)) missing.add("Valid order item quantities");
  const trueCost = addMoney(...Object.values(totals)); const grossProfit = subtractMoney(revenue, addMoney(totals.product_cost, totals.shipping, totals.customs));
  const refundPolicy = order.status === "refunded" || order.status === "partially_refunded" || order.status === "returned" ? "requires_policy" : "none";
  if (refundPolicy === "requires_policy") missing.add("Refund and return cost-reversal policy");
  const status: FinancialStatus = missing.size ? "incomplete" : estimated.size || order.source === "estimated" || order.source === "demo" ? "estimated" : "actual";
  const trueProfit = status === "incomplete" ? null : subtractMoney(revenue, trueCost);
  return { status, missingComponents: [...missing], estimatedComponents: [...estimated], sources: [...sources], revenue, discounts: order.discounts, productCost: totals.product_cost, shipping: totals.shipping, customs: totals.customs, packaging: totals.packaging, paymentFees: totals.payment_fee, advertisingAllocation: totals.advertising, subscriptionAllocation: totals.subscription, otherCosts: totals.other, trueCost, grossProfit, trueProfit, marginBps: trueProfit === null || revenue === 0 ? null : Math.round((trueProfit * 10_000) / revenue), breakdown, calculatedAt: input.calculatedAt, version: input.version ?? "2A.1", handling: { cancelled: "not_applicable", refunds: refundPolicy } };
}

function empty(order: Order, input: TrueCostInput, cancelled: "excluded"): TrueCostResult {
  return { status: "no_data", missingComponents: ["Cancelled orders are excluded from profit"], estimatedComponents: [], sources: [order.source], revenue: zeroMoney, discounts: order.discounts, productCost: zeroMoney, shipping: zeroMoney, customs: zeroMoney, packaging: zeroMoney, paymentFees: zeroMoney, advertisingAllocation: zeroMoney, subscriptionAllocation: zeroMoney, otherCosts: zeroMoney, trueCost: zeroMoney, grossProfit: null, trueProfit: null, marginBps: null, breakdown: [], calculatedAt: input.calculatedAt, version: input.version ?? "2A.1", handling: { cancelled, refunds: "none" } };
}
