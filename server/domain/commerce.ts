import type { DataScope, Id, Provenance } from "./tenant";
import type { MinorUnit } from "./money";

export type ProductStatus = "active" | "archived" | "draft";
export type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded" | "partially_refunded" | "returned";
export type RevenueBasis = "tax_inclusive" | "tax_exclusive" | "unknown";
export interface Product extends DataScope { id: Id; externalId?: string; source: Provenance; name: string; sku?: string; status: ProductStatus; createdAt: string; sourceUpdatedAt?: string; }
export interface Variant extends DataScope { id: Id; productId: Id; externalId?: string; source: Provenance; name: string; sku?: string; status: ProductStatus; createdAt: string; sourceUpdatedAt?: string; }
export interface Order extends DataScope { id: Id; externalId?: string; customerId?: Id; source: Provenance; status: OrderStatus; currency: string; merchandiseGross: MinorUnit; discounts: MinorUnit; taxAmount?: MinorUnit; shippingCharged: MinorUnit; refundedAmount: MinorUnit; revenueBasis: RevenueBasis; orderedAt: string; sourceUpdatedAt?: string; }
export interface OrderItem extends DataScope { id: Id; orderId: Id; productId?: Id; variantId?: Id; externalId?: string; source: Provenance; title: string; quantity: number; returnedQuantity: number; unitGross: MinorUnit; discountAmount: MinorUnit; sourceUpdatedAt?: string; }
export type CostCategory = "product_cost" | "shipping" | "customs" | "packaging" | "payment_fee" | "advertising" | "subscription" | "other";
export type CostScope = "store" | "product" | "variant" | "order" | "campaign";
export type CostCalculation = "fixed" | "per_order" | "per_product" | "per_unit" | "percentage" | "imported" | "calculated";
export type CostStatus = "actual" | "estimated" | "incomplete" | "not_configured";
export type AllocationStrategy = "per_order" | "per_unit" | "revenue_share" | "product_share" | "period_allocation" | "manual" | "actual_attribution";
export interface CostRule extends DataScope { id: Id; category: CostCategory; scope: CostScope; targetId?: Id; name: string; calculation: CostCalculation; amount?: MinorUnit; percentageBps?: number; fixedFee?: MinorUnit; source: Provenance; status: CostStatus; effectiveFrom: string; effectiveTo?: string; reference?: string; notes?: string; allocationStrategy?: AllocationStrategy; }
export interface CostAllocation extends DataScope { id: Id; costRuleId: Id; orderId: Id; amount: MinorUnit; strategy: AllocationStrategy; allocationPeriod?: { from: string; to: string }; source: Provenance; status: CostStatus; }
export interface CommerceRepository { findProduct(scope: DataScope, id: Id): Promise<Product | undefined>; listVariants(scope: DataScope, platform: string): Promise<Variant[]>; findOrder(scope: DataScope, id: Id): Promise<Order | undefined>; listOrderItems(scope: DataScope, orderId: Id): Promise<OrderItem[]>; }
export interface CostRepository { listEffectiveRules(scope: DataScope, at: string): Promise<CostRule[]>; listOrderAllocations(scope: DataScope, orderId: Id): Promise<CostAllocation[]>; }
