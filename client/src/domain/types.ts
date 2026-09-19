/** UI-independent vocabulary. It does not replace OLD screen-local demo data in Phase 0. */
export type Id = string;
export type IsoDateTime = string;
export type CurrencyCode = "SAR" | (string & {});
export type DataMode = "demo" | "live";
export type DataProvenance = "demo" | "actual" | "imported" | "calculated" | "estimated" | "manual" | "missing";
export type RecordState = "active" | "disabled" | "archived";
export interface Money { amount: number; currency: CurrencyCode; }
export interface Organization { id: Id; name: string; mode: DataMode; }
export type PlatformName = "salla" | "zid" | "shopify" | "other";
export interface Store { id: Id; organizationId: Id; name: string; platform: PlatformName; currency: CurrencyCode; }
export interface PlatformConnection { id: Id; storeId: Id; platform: PlatformName; status: "not_connected" | "requires_setup" | "connected" | "error" | "demo"; lastSyncedAt?: IsoDateTime; }
export interface Product { id: Id; storeId: Id; name: string; sku?: string; status: RecordState; }
export interface Variant { id: Id; productId: Id; sku?: string; title?: string; status: RecordState; }
export interface Customer { id: Id; storeId: Id; displayName?: string; }
export interface Order { id: Id; storeId: Id; customerId?: Id; orderedAt: IsoDateTime; status: string; total: Money; provenance: DataProvenance; }
export interface OrderItem { id: Id; orderId: Id; productId?: Id; variantId?: Id; quantity: number; unitPrice: Money; }
export interface Supplier { id: Id; organizationId: Id; name: string; status: RecordState; }
export interface Inventory { id: Id; storeId: Id; productId?: Id; variantId?: Id; availableQuantity: number; capturedAt: IsoDateTime; provenance: DataProvenance; }
export type CostScope = "store" | "product" | "variant" | "order" | "order_item";
export type CostCategory = "product" | "shipping" | "payment_fee" | "packaging" | "advertising" | "subscription" | "customs" | "other";
export interface Cost { id: Id; organizationId: Id; category: CostCategory; scope: CostScope; amount?: Money; provenance: DataProvenance; state: RecordState; effectiveFrom?: IsoDateTime; }
export interface CostRule { id: Id; costId: Id; allocationMethod: "fixed" | "per_unit" | "percentage" | "weighted"; state: RecordState; }
export interface Decision { id: Id; organizationId: Id; status: "draft" | "recommended" | "approved" | "rejected" | "completed"; title: string; financialImpact?: Money; createdAt: IsoDateTime; }
export interface Action { id: Id; organizationId: Id; title: string; priority: "critical" | "high" | "normal" | "low"; status: "open" | "in_progress" | "done" | "dismissed"; }
export interface Result { id: Id; decisionId?: Id; outcome: "positive" | "negative" | "neutral" | "unknown"; recordedAt: IsoDateTime; }
export interface BusinessMemory { id: Id; organizationId: Id; category: "rule" | "preference" | "pattern" | "product" | "supplier" | "decision"; body: string; provenance: DataProvenance; }
export interface Alert { id: Id; organizationId: Id; severity: "critical" | "warning" | "positive" | "info"; title: string; createdAt: IsoDateTime; }
