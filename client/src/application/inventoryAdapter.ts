import { money, type MinorUnit } from "../../../server/domain/money";
import type { CashPosition, InventoryState, OperationalStatus, ReorderConfiguration, SalesHistory, Supplier, SupplierProduct } from "../../../server/domain/inventory";
import type { Order, OrderItem } from "../../../server/domain/commerce";
import { calculateCashAwareDecision, calculateReorderRecommendation } from "../../../server/engines/inventory";

export interface MoneyView { minorUnits?: MinorUnit; display: string; unavailable: boolean; }
export interface InventoryDisplay { productId: string; name: string; sku: string; stock?: number; coverage: string; velocity: string; stockout: string; signal: string; tone: "teal" | "amber" | "red" | "violet"; status: OperationalStatus; supplierName?: string; leadTime: string; moq: string; reorderQuantity: string; reorderCost: MoneyView; missingInputs: string[]; }
export interface CashDecisionDisplay { quantity: number; currentCash: MoneyView; obligations: MoneyView; reorderCost: MoneyView; projectedCash: MoneyView; cashFloor: MoneyView; cashFloorConfigured: boolean; stockout: string; leadTime: string; status: OperationalStatus; lifecycle: string; missingInputs: string[]; }
export interface OrderDisplay { id: string; source: string; orderedAt: string; status: string; paymentStatus: string; customerReference?: string; items: Array<{ title: string; variant?: string; quantity: number; revenue: MoneyView }>; revenue: MoneyView; discounts: MoneyView; trueCostStatus: OperationalStatus; trueProfitStatus: OperationalStatus; }

const scope = { organizationId: "demo-profitpilot", storeId: "demo-store", mode: "demo" as const };
const sar = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const presentMoney = (value: MinorUnit | undefined, status: OperationalStatus = "incomplete"): MoneyView => value === undefined ? { display: status === "no_data" ? "No data" : "Incomplete — not configured", unavailable: true } : { minorUnits: value, display: sar.format(value / 100), unavailable: false };
const dayLabel = (days: number | undefined, status: OperationalStatus) => days === undefined ? status === "no_data" ? "No data" : "Incomplete" : `${Math.round(days)} days`;
const dateLabel = (value: string | undefined, status: OperationalStatus) => value === undefined ? status === "no_data" ? "No data" : "Incomplete" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));

const suppliers: Supplier[] = [
  { ...scope, id: "supplier-x", name: "Supplier X", source: "demo", status: "estimated", reliability: "high", lastOrderAt: "2026-09-05" },
  { ...scope, id: "supplier-y", name: "Supplier Y", source: "demo", status: "estimated", reliability: "medium" },
];
const inventory: InventoryState[] = [
  { ...scope, id: "inventory-pima", productId: "pima", variantId: "pima-black-m", currentStock: 85, availableStock: 85, source: "demo", status: "estimated", observedAt: "2026-09-19T00:00:00Z" },
  { ...scope, id: "inventory-spandex", productId: "spandex", variantId: "spandex-black-m", currentStock: 142, availableStock: 142, source: "demo", status: "estimated", observedAt: "2026-09-19T00:00:00Z" },
  { ...scope, id: "inventory-burgundy", productId: "burgundy", currentStock: 490, availableStock: 490, source: "demo", status: "no_data", observedAt: "2026-09-19T00:00:00Z" },
  { ...scope, id: "inventory-socks", productId: "socks", currentStock: 210, availableStock: 210, source: "demo", status: "estimated", observedAt: "2026-09-19T00:00:00Z" },
];
const sales: SalesHistory[] = [
  { ...scope, productId: "pima", variantId: "pima-black-m", unitsSold: 255, periodDays: 30, source: "demo", status: "estimated" },
  { ...scope, productId: "spandex", variantId: "spandex-black-m", unitsSold: 177, periodDays: 30, source: "demo", status: "estimated" },
  { ...scope, productId: "burgundy", source: "demo", status: "no_data" },
  { ...scope, productId: "socks", unitsSold: 123, periodDays: 30, source: "demo", status: "estimated" },
];
const supplierProducts: SupplierProduct[] = [
  { ...scope, id: "supply-pima", supplierId: "supplier-x", productId: "pima", variantId: "pima-black-m", unitCost: money(3200), currency: "SAR", leadTimeDays: 15, moq: 200, source: "demo", status: "estimated" },
  { ...scope, id: "supply-spandex", supplierId: "supplier-y", productId: "spandex", variantId: "spandex-black-m", unitCost: money(3100), currency: "SAR", leadTimeDays: 20, moq: 100, source: "demo", status: "estimated" },
  { ...scope, id: "supply-socks", supplierId: "supplier-y", productId: "socks", unitCost: money(700), currency: "SAR", source: "demo", status: "incomplete" },
];
const configurations: ReorderConfiguration[] = [
  { ...scope, productId: "pima", variantId: "pima-black-m", safetyStock: 50, reviewPeriodDays: 9, source: "demo", status: "estimated" },
  { ...scope, productId: "spandex", variantId: "spandex-black-m", safetyStock: 40, reviewPeriodDays: 7, source: "demo", status: "estimated" },
  { ...scope, productId: "socks", safetyStock: 30, source: "demo", status: "estimated" },
];
const productMeta = [
  { productId: "pima", name: "IRONCLAD Pima T-Shirt", sku: "PMA-001" }, { productId: "spandex", name: "IRONCLAD Spandex T-Shirt", sku: "SPX-014" }, { productId: "burgundy", name: "Burgundy Overshirt", sku: "BRG-008" }, { productId: "socks", name: "Studio Socks Set", sku: "STS-022" },
];
const recommendationFor = (productId: string) => calculateReorderRecommendation({ scope, productId, variantId: inventory.find((item) => item.productId === productId)?.variantId, inventory: inventory.find((item) => item.productId === productId), sales: sales.find((item) => item.productId === productId), supplierProduct: supplierProducts.find((item) => item.productId === productId), configuration: configurations.find((item) => item.productId === productId), calculatedAt: "2026-09-19T00:00:00Z", source: "demo" });

export function demoInventoryDisplays(): InventoryDisplay[] {
  return productMeta.map((meta) => {
    const recommendation = recommendationFor(meta.productId); const supplier = suppliers.find((item) => item.id === recommendation.supplierId);
    const tone = recommendation.status === "no_data" ? "violet" : recommendation.status === "incomplete" ? "amber" : recommendation.coverageDays !== undefined && recommendation.coverageDays < (recommendation.supplierLeadTimeDays ?? Infinity) ? "red" : "teal";
    const signal = recommendation.status === "no_data" ? "No data" : recommendation.status === "incomplete" ? "Incomplete inputs" : tone === "red" ? "At risk" : "Healthy";
    return { productId: meta.productId, name: meta.name, sku: meta.sku, stock: recommendation.availableStock, coverage: dayLabel(recommendation.coverageDays, recommendation.status), velocity: recommendation.salesVelocityPerDay === undefined ? recommendation.status === "no_data" ? "No data" : "Incomplete" : `${recommendation.salesVelocityPerDay.toFixed(1)} / day`, stockout: dateLabel(recommendation.estimatedStockoutAt, recommendation.status), signal, tone, status: recommendation.status, supplierName: supplier?.name, leadTime: recommendation.supplierLeadTimeDays === undefined ? "Not configured" : `${recommendation.supplierLeadTimeDays} days`, moq: recommendation.moq === undefined ? "Not configured" : `${recommendation.moq} units`, reorderQuantity: recommendation.reorderQuantity === undefined ? "Incomplete" : `${recommendation.reorderQuantity} units`, reorderCost: presentMoney(recommendation.reorderCost, recommendation.status), missingInputs: recommendation.missingInputs };
  });
}

const cash: CashPosition = { ...scope, currentCash: money(2_500_000), knownImmediateObligations: money(800_000), cashFloor: money(2_000_000), currency: "SAR", source: "demo", status: "estimated", observedAt: "2026-09-19T00:00:00Z" };
export function demoCashAwareDecision(quantity = recommendationFor("pima").reorderQuantity ?? 0): CashDecisionDisplay {
  const base = recommendationFor("pima"); const recommendation = { ...base, reorderQuantity: quantity, reorderCost: base.supplierUnitCost === undefined ? undefined : money(quantity * base.supplierUnitCost), missingInputs: base.supplierUnitCost === undefined ? [...base.missingInputs, "Supplier unit cost is not configured"] : base.missingInputs };
  const decision = calculateCashAwareDecision({ id: "decision-pima-reorder", lifecycle: "approval_required", recommendation, cash, calculatedAt: "2026-09-19T00:00:00Z", source: "demo" });
  return { quantity, currentCash: presentMoney(decision.currentCash, decision.status), obligations: presentMoney(decision.knownImmediateObligations, decision.status), reorderCost: presentMoney(decision.reorderCost, decision.status), projectedCash: presentMoney(decision.projectedCash, decision.status), cashFloor: presentMoney(decision.cashFloor, decision.cashFloorStatus === "configured" ? decision.status : "incomplete"), cashFloorConfigured: decision.cashFloorStatus === "configured", stockout: dateLabel(decision.recommendation.estimatedStockoutAt, decision.status), leadTime: decision.recommendation.supplierLeadTimeDays === undefined ? "Not configured" : `${decision.recommendation.supplierLeadTimeDays} days`, status: decision.status, lifecycle: decision.lifecycle, missingInputs: decision.missingInputs };
}

const demoOrder: Order = { ...scope, id: "order-10482", externalId: "10482", source: "demo", status: "paid", currency: "SAR", merchandiseGross: money(14_900), discounts: money(0), shippingCharged: money(0), refundedAmount: money(0), revenueBasis: "tax_inclusive", orderedAt: "2026-09-19T00:00:00Z" };
const demoOrderItems: OrderItem[] = [{ ...scope, id: "order-10482-pima", orderId: demoOrder.id, productId: "pima", variantId: "pima-black-m", source: "demo", title: "IRONCLAD Pima T-Shirt", quantity: 1, returnedQuantity: 0, unitGross: money(14_900), discountAmount: money(0) }];
export function demoOrderDisplay(): OrderDisplay { return { id: demoOrder.externalId ?? demoOrder.id, source: "Demo", orderedAt: demoOrder.orderedAt, status: demoOrder.status, paymentStatus: "Paid", customerReference: "Demo order", items: demoOrderItems.map((item) => ({ title: item.title, quantity: item.quantity, revenue: presentMoney(item.unitGross) })), revenue: presentMoney(demoOrder.merchandiseGross), discounts: presentMoney(demoOrder.discounts), trueCostStatus: "estimated", trueProfitStatus: "estimated" }; }
