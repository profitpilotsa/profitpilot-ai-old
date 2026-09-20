import type { MinorUnit } from "./money";
import type { DataScope, Id, Provenance } from "./tenant";

export type OperationalStatus = "actual" | "estimated" | "incomplete" | "no_data";
export type DecisionStatus = "detected" | "explained" | "adjusted" | "approval_required" | "approved" | "executed" | "failed";

export interface InventoryState extends DataScope { id: Id; productId: Id; variantId?: Id; currentStock?: number; availableStock?: number; reservedStock?: number; inboundStock?: number; source: Provenance; status: OperationalStatus; observedAt: string; }
export interface SalesHistory extends DataScope { productId: Id; variantId?: Id; unitsSold?: number; periodDays?: number; source: Provenance; status: OperationalStatus; periodFrom?: string; periodTo?: string; }
export interface Supplier extends DataScope { id: Id; name: string; source: Provenance; status: OperationalStatus; reliability?: "high" | "medium" | "low"; lastOrderAt?: string; notes?: string; }
export interface SupplierProduct extends DataScope { id: Id; supplierId: Id; productId: Id; variantId?: Id; unitCost?: MinorUnit; currency: string; leadTimeDays?: number; moq?: number; expectedDeliveryAt?: string; source: Provenance; status: OperationalStatus; reference?: string; notes?: string; }
export interface ReorderConfiguration extends DataScope { productId: Id; variantId?: Id; safetyStock?: number; reviewPeriodDays?: number; source: Provenance; status: OperationalStatus; }
export interface ReorderRecommendation extends DataScope { productId: Id; variantId?: Id; status: OperationalStatus; currentStock?: number; availableStock?: number; salesVelocityPerDay?: number; coverageDays?: number; estimatedStockoutAt?: string; reorderPoint?: number; reorderQuantity?: number; supplierId?: Id; supplierLeadTimeDays?: number; moq?: number; supplierUnitCost?: MinorUnit; currency?: string; reorderCost?: MinorUnit; missingInputs: string[]; explanations: string[]; source: Provenance; calculatedAt: string; }
export interface CashPosition extends DataScope { currentCash?: MinorUnit; knownImmediateObligations?: MinorUnit; cashFloor?: MinorUnit; currency: string; source: Provenance; status: OperationalStatus; observedAt: string; }
export interface CashAwareDecision extends DataScope { id: Id; recommendation: ReorderRecommendation; status: OperationalStatus; lifecycle: DecisionStatus; currentCash?: MinorUnit; reorderCost?: MinorUnit; knownImmediateObligations?: MinorUnit; obligationsStatus: "provided" | "none_known"; projectedCash?: MinorUnit; cashFloor?: MinorUnit; cashFloorStatus: "configured" | "not_configured"; missingInputs: string[]; calculatedAt: string; source: Provenance; }

export interface InventoryRepository { findInventory(scope: DataScope, productId: Id, variantId?: Id): Promise<InventoryState | undefined>; findSalesHistory(scope: DataScope, productId: Id, variantId?: Id): Promise<SalesHistory | undefined>; findReorderConfiguration(scope: DataScope, productId: Id, variantId?: Id): Promise<ReorderConfiguration | undefined>; }
export interface SupplierRepository { listSuppliers(scope: DataScope): Promise<Supplier[]>; findSupplierProduct(scope: DataScope, supplierId: Id, productId: Id, variantId?: Id): Promise<SupplierProduct | undefined>; }
export interface CashDecisionRepository { findCashPosition(scope: DataScope): Promise<CashPosition | undefined>; saveDecision(scope: DataScope, decision: CashAwareDecision): Promise<CashAwareDecision>; }
