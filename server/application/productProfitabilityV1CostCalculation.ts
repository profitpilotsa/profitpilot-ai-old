import { calculateTrueCost, isApplicableCostRule, type Component, type FinancialStatus } from "../engines/trueCost";
import { subtractMoney, type MinorUnit } from "../domain/money";
import type { CostAllocation, CostCategory, CostRule, Order, OrderItem } from "../domain/commerce";
import { classifyProductProfitabilityV1Costs, type ProductProfitabilityV1CostPolicy } from "./productProfitabilityCostPolicy";

export interface ProductProfitabilityV1OrderCostInput {
  order: Order;
  items: readonly OrderItem[];
  rules: readonly CostRule[];
  allocations: readonly CostAllocation[];
  calculatedAt: string;
}

export interface ProductProfitabilityV1OrderCost {
  status: FinancialStatus;
  revenue: MinorUnit;
  directCost: MinorUnit;
  directProfit: MinorUnit | null;
  marginBps: number | null;
  missingComponents: readonly string[];
  estimatedComponents: readonly string[];
  sources: readonly string[];
  breakdown: readonly Component[];
  calculatedAt: string;
  policy: ProductProfitabilityV1CostPolicy;
}

const categoryLabel: Record<CostCategory, string> = {
  product_cost: "Product cost",
  shipping: "Shipping",
  customs: "Customs / import",
  packaging: "Packaging",
  payment_fee: "Payment fees",
  advertising: "Advertising allocation",
  subscription: "Subscription allocation",
  other: "Other costs",
};

const directCategoryLabels = (rules: readonly CostRule[]) => new Set(rules.map((rule) => categoryLabel[rule.category]));

/**
 * Calculates only V1 Product Profitability direct economics. The generic
 * True Cost engine remains unchanged and is used solely for selected-rule
 * arithmetic; policy-aware completeness is derived here.
 */
export function calculateProductProfitabilityV1OrderCost(input: ProductProfitabilityV1OrderCostInput): ProductProfitabilityV1OrderCost {
  const { order, items, rules, allocations, calculatedAt } = input;
  const policy = classifyProductProfitabilityV1Costs({ order, items, rules, allocations });
  const directRuleIds = new Set(policy.rules.filter((candidate) => candidate.classification === "PRODUCT_DIRECT").map((candidate) => candidate.costRuleId));
  const directRules = rules.filter((rule) => directRuleIds.has(rule.id));
  const generic = calculateTrueCost({ order, items: [...items], rules: directRules, allocations: [], calculatedAt });

  const missing = new Set<string>();
  const selectedCategoryLabels = directCategoryLabels(directRules);
  for (const component of generic.missingComponents) {
    if (component === "Tenant/store scope mismatch in True Cost inputs" || component === "Valid order item quantities" || selectedCategoryLabels.has(component)) missing.add(component);
  }
  if (!directRules.some((rule) => rule.category === "product_cost")) missing.add("Product cost");

  const applicableUnallocatedRules = policy.rules.filter((candidate) => {
    if (candidate.classification === "STORE_LEVEL" || candidate.classification === "PRODUCT_DIRECT") return false;
    const rule = rules.find((record) => record.id === candidate.costRuleId);
    return rule !== undefined && isApplicableCostRule(rule, order, items);
  });
  if (policy.ambiguousCostRuleIds.length > 0) missing.add("Cost Rule and Cost Allocation precedence");
  else if (applicableUnallocatedRules.length > 0) missing.add("Unallocated Product Profitability cost facts");
  const hasUnallocatedOrderAllocation = policy.allocations.some((candidate) => {
    if (candidate.classification !== "UNALLOCATED_UNTIL_KNOWN") return false;
    const allocation = allocations.find((record) => record.id === candidate.allocationId);
    return allocation !== undefined && allocation.organizationId === order.organizationId && allocation.storeId === order.storeId && allocation.orderId === order.id;
  });
  if (hasUnallocatedOrderAllocation) missing.add("Unallocated Cost Allocation facts");

  const status: FinancialStatus = missing.size > 0
    ? "incomplete"
    : generic.estimatedComponents.length > 0 || order.source === "estimated" || order.source === "demo"
      ? "estimated"
      : "actual";
  const directProfit = status === "incomplete" ? null : subtractMoney(generic.revenue, generic.trueCost);

  return {
    status,
    revenue: generic.revenue,
    directCost: generic.trueCost,
    directProfit,
    marginBps: directProfit === null || generic.revenue === 0 ? null : Math.round((directProfit * 10_000) / generic.revenue),
    missingComponents: Array.from(missing).sort(),
    estimatedComponents: generic.estimatedComponents,
    sources: generic.sources,
    breakdown: generic.breakdown,
    calculatedAt,
    policy,
  };
}
