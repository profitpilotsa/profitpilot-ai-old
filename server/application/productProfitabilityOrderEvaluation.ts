import type { Order } from "../domain/commerce";
import type { MinorUnit } from "../domain/money";
import type { Id } from "../domain/tenant";
import { classifyProductProfitabilityOrder, type ProductProfitabilityEligibility, type ProductProfitabilityEligibilityInput, type ProductProfitabilityEligibilityReason } from "./productProfitabilityEligibility";
import { calculateProductProfitabilityV1OrderCost, type ProductProfitabilityV1OrderCost } from "./productProfitabilityV1CostCalculation";

export interface ProductProfitabilityRawOrderFacts {
  orderId: Id;
  status: Order["status"];
  currency: string;
  revenueBasis: Order["revenueBasis"];
  merchandiseGross: MinorUnit;
  discounts: MinorUnit;
  shippingCharged: MinorUnit;
  refundedAmount: MinorUnit;
  taxAmount?: MinorUnit;
}

interface ProductProfitabilityOrderEvaluationBase {
  orderId: Id;
  affectedProductIds: readonly Id[];
  reasons: readonly ProductProfitabilityEligibilityReason[];
  rawOrderFacts: ProductProfitabilityRawOrderFacts;
}

export interface EligibleProductProfitabilityOrderEvaluation extends ProductProfitabilityOrderEvaluationBase {
  classification: "eligible";
  productId: Id;
  trueCost: ProductProfitabilityV1OrderCost;
}

export interface UnallocatedProductProfitabilityOrderEvaluation extends ProductProfitabilityOrderEvaluationBase {
  classification: "unallocated";
}

export interface ExcludedProductProfitabilityOrderEvaluation extends ProductProfitabilityOrderEvaluationBase {
  classification: "excluded";
}

export type ProductProfitabilityOrderEvaluation = EligibleProductProfitabilityOrderEvaluation | UnallocatedProductProfitabilityOrderEvaluation | ExcludedProductProfitabilityOrderEvaluation;

export interface ProductProfitabilityOrderEvaluationInput extends ProductProfitabilityEligibilityInput {
  calculatedAt: string;
}

const rawOrderFacts = (order: Order): ProductProfitabilityRawOrderFacts => ({
  orderId: order.id,
  status: order.status,
  currency: order.currency,
  revenueBasis: order.revenueBasis,
  merchandiseGross: order.merchandiseGross,
  discounts: order.discounts,
  shippingCharged: order.shippingCharged,
  refundedAmount: order.refundedAmount,
  taxAmount: order.taxAmount,
});

const evaluationBase = (order: Order, eligibility: ProductProfitabilityEligibility): ProductProfitabilityOrderEvaluationBase => ({
  orderId: order.id,
  affectedProductIds: eligibility.affectedProductIds,
  reasons: eligibility.reasons,
  rawOrderFacts: rawOrderFacts(order),
});

export function evaluateProductProfitabilityOrder(input: ProductProfitabilityOrderEvaluationInput): ProductProfitabilityOrderEvaluation {
  const { scope, platform, order, items, products, variants, rules, allocations, calculatedAt } = input;
  const eligibility = classifyProductProfitabilityOrder({ scope, platform, order, items, products, variants, rules, allocations });
  const base = evaluationBase(order, eligibility);

  if (eligibility.classification === "unallocated") return { classification: "unallocated", ...base };
  if (eligibility.classification === "excluded") return { classification: "excluded", ...base };
  if (!eligibility.attributedProductId) throw new Error("Eligible Product Profitability classification requires an attributed Product ID");

  return {
    classification: "eligible",
    ...base,
    productId: eligibility.attributedProductId,
    trueCost: calculateProductProfitabilityV1OrderCost({ order, items, rules, allocations, calculatedAt }),
  };
}
