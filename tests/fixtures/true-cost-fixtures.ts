import { money } from "../../server/domain/money";
import type { CostRule, Order, OrderItem } from "../../server/domain/commerce";

export const scope = { organizationId: "org-a", storeId: "store-a", mode: "live" as const };
export const order: Order = { ...scope, id: "order-1", externalId: "platform-1", source: "platform", status: "paid", currency: "SAR", merchandiseGross: money(10_000), discounts: money(1_000), taxAmount: money(1_350), shippingCharged: money(500), refundedAmount: money(0), revenueBasis: "tax_inclusive", orderedAt: "2026-01-15T00:00:00Z" };
export const items: OrderItem[] = [{ ...scope, id: "item-1", orderId: order.id, productId: "product-a", variantId: "variant-a", source: "platform", title: "Known fixture item", quantity: 2, returnedQuantity: 0, unitGross: money(5_000), discountAmount: money(1_000) }];
export const coreRules: CostRule[] = [
  { ...scope, id: "product", category: "product_cost", scope: "variant", targetId: "variant-a", name: "Historical unit cost", calculation: "per_unit", amount: money(2_000), source: "imported", status: "actual", effectiveFrom: "2026-01-01T00:00:00Z" },
  { ...scope, id: "shipping", category: "shipping", scope: "order", name: "Carrier cost", calculation: "fixed", amount: money(700), source: "imported", status: "actual", effectiveFrom: "2026-01-01T00:00:00Z" },
  { ...scope, id: "payment", category: "payment_fee", scope: "order", name: "Gateway", calculation: "percentage", percentageBps: 250, fixedFee: money(100), source: "platform", status: "actual", effectiveFrom: "2026-01-01T00:00:00Z" },
  { ...scope, id: "packaging", category: "packaging", scope: "store", name: "Packaging", calculation: "per_order", amount: money(200), source: "manual", status: "estimated", effectiveFrom: "2026-01-01T00:00:00Z" },
];
// Known manual result: revenue 9,500; costs 4,000 + 700 + 325 + 200 = 5,225; true profit 4,275.
