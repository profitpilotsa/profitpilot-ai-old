import type { CostAllocation, CostRule, Order, OrderItem, Product, Variant } from "../domain/commerce";
import type { Id, DataScope } from "../domain/tenant";
import { isApplicableCostRule, isEffectiveCostRule } from "../engines/trueCost";

export type ProductProfitabilityEligibilityReason = "CANCELLED" | "NO_ORDER_ITEMS" | "SCOPE_OR_ORDER_MISMATCH" | "UNKNOWN_PRODUCT" | "MULTIPLE_PRODUCTS" | "INVALID_VARIANT_RELATIONSHIP" | "UNSAFE_VARIANT_RULE_COMBINATION" | "INVALID_QUANTITY_OR_MONEY" | "MERCHANDISE_RECONCILIATION_FAILED" | "RETURN_OR_REFUND_POLICY_REQUIRED" | "UNSUPPORTED_ORDER_STATUS" | "UNSUPPORTED_CURRENCY" | "UNSUPPORTED_REVENUE_BASIS" | "AMBIGUOUS_COST_RULES" | "ALLOCATION_RULE_AMBIGUITY";
export type ProductProfitabilityOrderClassification = "eligible" | "unallocated" | "excluded";
export interface ProductProfitabilityEligibilityInput { scope: DataScope; platform: string; order: Order; items: readonly OrderItem[]; products: readonly Product[]; variants: readonly Variant[]; rules: readonly CostRule[]; allocations: readonly CostAllocation[]; }
export interface ProductProfitabilityEligibility { classification: ProductProfitabilityOrderClassification; attributedProductId?: Id; affectedProductIds: readonly Id[]; reasons: readonly ProductProfitabilityEligibilityReason[]; }

const reasonOrder: readonly ProductProfitabilityEligibilityReason[] = ["CANCELLED", "NO_ORDER_ITEMS", "SCOPE_OR_ORDER_MISMATCH", "UNKNOWN_PRODUCT", "MULTIPLE_PRODUCTS", "INVALID_VARIANT_RELATIONSHIP", "UNSAFE_VARIANT_RULE_COMBINATION", "INVALID_QUANTITY_OR_MONEY", "MERCHANDISE_RECONCILIATION_FAILED", "RETURN_OR_REFUND_POLICY_REQUIRED", "UNSUPPORTED_ORDER_STATUS", "UNSUPPORTED_CURRENCY", "UNSUPPORTED_REVENUE_BASIS", "AMBIGUOUS_COST_RULES", "ALLOCATION_RULE_AMBIGUITY"];
const hasScope = (scope: DataScope, record: DataScope) => scope.organizationId === record.organizationId && scope.storeId === record.storeId;
const validMoney = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value >= 0;

export function classifyProductProfitabilityOrder(input: ProductProfitabilityEligibilityInput): ProductProfitabilityEligibility {
  const { scope, order, items, products, variants, rules, allocations } = input;
  if (order.status === "cancelled") return { classification: "excluded", affectedProductIds: [], reasons: ["CANCELLED"] };
  const reasons = new Set<ProductProfitabilityEligibilityReason>();
  if (!hasScope(scope, order)) reasons.add("SCOPE_OR_ORDER_MISMATCH");
  if (items.length === 0) reasons.add("NO_ORDER_ITEMS");
  if (["refunded", "partially_refunded", "returned"].includes(order.status) || order.refundedAmount > 0) reasons.add("RETURN_OR_REFUND_POLICY_REQUIRED");
  else if (order.status !== "paid" && order.status !== "fulfilled") reasons.add("UNSUPPORTED_ORDER_STATUS");
  if (order.currency !== "SAR") reasons.add("UNSUPPORTED_CURRENCY");
  if (order.revenueBasis !== "tax_inclusive") reasons.add("UNSUPPORTED_REVENUE_BASIS");
  if (![order.merchandiseGross, order.discounts, order.shippingCharged, order.refundedAmount, order.taxAmount].filter(value => value !== undefined).every(validMoney) || order.discounts > order.merchandiseGross) reasons.add("INVALID_QUANTITY_OR_MONEY");

  const scopedProducts = new Map(products.filter(product => hasScope(scope, product)).map(product => [product.id, product]));
  const scopedVariants = new Map(variants.filter(variant => hasScope(scope, variant)).map(variant => [variant.id, variant]));
  if (products.length !== scopedProducts.size || variants.length !== scopedVariants.size) reasons.add("SCOPE_OR_ORDER_MISMATCH");
  const affected = new Set<Id>(); const validVariantIds = new Set<Id>(); let itemGross = 0;
  for (const item of items) {
    const trustedItem = hasScope(scope, item) && item.orderId === order.id;
    if (!trustedItem) { reasons.add("SCOPE_OR_ORDER_MISMATCH"); continue; }
    if (!Number.isInteger(item.quantity) || !Number.isInteger(item.returnedQuantity) || item.quantity <= 0 || item.returnedQuantity < 0 || item.returnedQuantity > item.quantity || !validMoney(item.unitGross) || !validMoney(item.discountAmount) || !Number.isSafeInteger(item.unitGross * item.quantity)) reasons.add("INVALID_QUANTITY_OR_MONEY");
    if (item.returnedQuantity > 0) reasons.add("RETURN_OR_REFUND_POLICY_REQUIRED");
    itemGross += item.unitGross * item.quantity;
    if (!item.productId || !scopedProducts.has(item.productId)) { reasons.add("UNKNOWN_PRODUCT"); continue; }
    affected.add(item.productId);
    if (item.variantId) {
      const variant = scopedVariants.get(item.variantId);
      if (!variant || variant.productId !== item.productId) reasons.add("INVALID_VARIANT_RELATIONSHIP");
      else validVariantIds.add(variant.id);
    }
  }
  if (!Number.isSafeInteger(itemGross)) reasons.add("INVALID_QUANTITY_OR_MONEY");
  else if (itemGross !== order.merchandiseGross) reasons.add("MERCHANDISE_RECONCILIATION_FAILED");
  if (affected.size > 1) reasons.add("MULTIPLE_PRODUCTS");

  const scopedRules = rules.filter(rule => hasScope(scope, rule));
  if (rules.length !== scopedRules.length || allocations.some(allocation => !hasScope(scope, allocation))) reasons.add("SCOPE_OR_ORDER_MISMATCH");
  const effectiveRules = scopedRules.filter(rule => isEffectiveCostRule(rule, order.orderedAt));
  const candidateRules = effectiveRules.filter(rule => isApplicableCostRule(rule, order, items));
  if ([...new Set(candidateRules.map(rule => rule.category))].some(category => candidateRules.filter(rule => rule.category === category).length > 1)) reasons.add("AMBIGUOUS_COST_RULES");
  if (validVariantIds.size > 1 && candidateRules.some(rule => rule.scope === "variant")) reasons.add("UNSAFE_VARIANT_RULE_COMBINATION");
  const orderAllocations = allocations.filter(allocation => hasScope(scope, allocation) && allocation.orderId === order.id);
  for (const allocation of orderAllocations) {
    if (orderAllocations.filter(candidate => candidate.costRuleId === allocation.costRuleId).length > 1) reasons.add("ALLOCATION_RULE_AMBIGUITY");
    const rule = scopedRules.find(candidate => candidate.id === allocation.costRuleId);
    if (!rule || !isEffectiveCostRule(rule, order.orderedAt) || isApplicableCostRule(rule, order, items)) reasons.add("ALLOCATION_RULE_AMBIGUITY");
  }
  const affectedProductIds = [...affected].sort(); const orderedReasons = reasonOrder.filter(reason => reasons.has(reason));
  if (orderedReasons.length > 0) return { classification: "unallocated", affectedProductIds, reasons: orderedReasons };
  const [attributedProductId] = affectedProductIds;
  if (!attributedProductId || affectedProductIds.length !== 1) return { classification: "unallocated", affectedProductIds, reasons: ["UNKNOWN_PRODUCT"] };
  return { classification: "eligible", attributedProductId, affectedProductIds, reasons: [] };
}
