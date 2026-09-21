import type { CostAllocation, CostRule, Order, OrderItem } from "../domain/commerce";
import type { Id } from "../domain/tenant";
import { isApplicableCostRule, isEffectiveCostRule } from "../engines/trueCost";

export type ProductProfitabilityV1CostClassification = "PRODUCT_DIRECT" | "ORDER_ACTUAL" | "STORE_LEVEL" | "UNALLOCATED_UNTIL_KNOWN";

export interface ProductProfitabilityV1CostPolicyInput {
  order: Order;
  items: readonly OrderItem[];
  rules: readonly CostRule[];
  allocations: readonly CostAllocation[];
}

export interface ClassifiedProductProfitabilityCostRule {
  kind: "cost_rule";
  costRuleId: Id;
  classification: ProductProfitabilityV1CostClassification;
  reason: string;
}

export interface ClassifiedProductProfitabilityCostAllocation {
  kind: "cost_allocation";
  allocationId: Id;
  costRuleId: Id;
  classification: ProductProfitabilityV1CostClassification;
  reason: string;
}

export interface ProductProfitabilityV1CostPolicy {
  rules: readonly ClassifiedProductProfitabilityCostRule[];
  allocations: readonly ClassifiedProductProfitabilityCostAllocation[];
  ambiguousCostRuleIds: readonly Id[];
}

const hasOrderScope = (order: Order, record: { organizationId: Id; storeId?: Id }) => order.organizationId === record.organizationId && order.storeId === record.storeId;
const directCategories = new Set<CostRule["category"]>(["product_cost", "shipping", "customs", "packaging", "other"]);

function classifiableDirectRule(rule: CostRule, order: Order, items: readonly OrderItem[]) {
  if (!directCategories.has(rule.category)) return false;
  if (rule.scope !== "product" && rule.scope !== "variant") return false;
  return isEffectiveCostRule(rule, order.orderedAt) && isApplicableCostRule(rule, order, items);
}

function classifyRule(rule: CostRule, order: Order, items: readonly OrderItem[], ambiguousCostRuleIds: ReadonlySet<Id>): ClassifiedProductProfitabilityCostRule {
  if (!hasOrderScope(order, rule)) return { kind: "cost_rule", costRuleId: rule.id, classification: "UNALLOCATED_UNTIL_KNOWN", reason: "Rule is outside the Order organization/store scope" };
  if (ambiguousCostRuleIds.has(rule.id)) return { kind: "cost_rule", costRuleId: rule.id, classification: "UNALLOCATED_UNTIL_KNOWN", reason: "Rule has an Order allocation; V1 does not choose Rule-versus-Allocation precedence" };
  if (rule.category === "advertising" || rule.category === "subscription") return { kind: "cost_rule", costRuleId: rule.id, classification: "STORE_LEVEL", reason: "Advertising and subscriptions are store-level in V1" };
  if (rule.category === "payment_fee") return { kind: "cost_rule", costRuleId: rule.id, classification: "UNALLOCATED_UNTIL_KNOWN", reason: "Configured payment-fee rules are not actual transaction-fee facts" };
  if (rule.scope === "store") return { kind: "cost_rule", costRuleId: rule.id, classification: "STORE_LEVEL", reason: "Store-scoped cost is not automatically distributed to Products" };
  if (classifiableDirectRule(rule, order, items)) return { kind: "cost_rule", costRuleId: rule.id, classification: "PRODUCT_DIRECT", reason: "Effective Product/Variant-scoped direct cost applies to an Order Item" };
  return { kind: "cost_rule", costRuleId: rule.id, classification: "UNALLOCATED_UNTIL_KNOWN", reason: "Current category and scope do not prove direct or actual Order-level meaning" };
}

function classifyAllocation(allocation: CostAllocation, order: Order, ambiguousCostRuleIds: ReadonlySet<Id>): ClassifiedProductProfitabilityCostAllocation {
  if (!hasOrderScope(order, allocation) || allocation.orderId !== order.id) return { kind: "cost_allocation", allocationId: allocation.id, costRuleId: allocation.costRuleId, classification: "UNALLOCATED_UNTIL_KNOWN", reason: "Allocation is outside the requested Order scope" };
  if (ambiguousCostRuleIds.has(allocation.costRuleId)) return { kind: "cost_allocation", allocationId: allocation.id, costRuleId: allocation.costRuleId, classification: "UNALLOCATED_UNTIL_KNOWN", reason: "V1 does not infer precedence between an Allocation and its Cost Rule" };
  return { kind: "cost_allocation", allocationId: allocation.id, costRuleId: allocation.costRuleId, classification: "UNALLOCATED_UNTIL_KNOWN", reason: "Order link alone does not establish an authoritative transaction-cost fact" };
}

/**
 * Pure V1 policy boundary. It classifies existing candidates but deliberately
 * does not change True Cost calculation or choose allocation precedence.
 */
export function classifyProductProfitabilityV1Costs(input: ProductProfitabilityV1CostPolicyInput): ProductProfitabilityV1CostPolicy {
  const { order, items, rules, allocations } = input;
  const ambiguousCostRuleIds = new Set<Id>();
  for (const allocation of allocations) {
    if (hasOrderScope(order, allocation) && allocation.orderId === order.id && rules.some((rule) => hasOrderScope(order, rule) && rule.id === allocation.costRuleId && isEffectiveCostRule(rule, order.orderedAt) && isApplicableCostRule(rule, order, items))) ambiguousCostRuleIds.add(allocation.costRuleId);
  }
  return {
    rules: rules.map((rule) => classifyRule(rule, order, items, ambiguousCostRuleIds)),
    allocations: allocations.map((allocation) => classifyAllocation(allocation, order, ambiguousCostRuleIds)),
    ambiguousCostRuleIds: Array.from(ambiguousCostRuleIds).sort(),
  };
}
