import { money, subtractMoney, zeroMoney, type MinorUnit } from "../domain/money";
import type { CashAwareDecision, CashPosition, InventoryState, OperationalStatus, ReorderConfiguration, ReorderRecommendation, SalesHistory, SupplierProduct } from "../domain/inventory";
import type { DataScope, Id, Provenance } from "../domain/tenant";

export interface Metric { value?: number; status: OperationalStatus; missingInputs: string[]; }
export interface InventoryRecommendationInput { scope: DataScope; productId: Id; variantId?: Id; inventory?: InventoryState; sales?: SalesHistory; supplierProduct?: SupplierProduct; configuration?: ReorderConfiguration; calculatedAt: string; source?: Provenance; }
export interface CashDecisionInput { id: Id; lifecycle: CashAwareDecision["lifecycle"]; recommendation: ReorderRecommendation; cash?: CashPosition; calculatedAt: string; source?: Provenance; }

const rank: Record<OperationalStatus, number> = { actual: 0, estimated: 1, incomplete: 2, no_data: 3 };
const combineStatus = (...statuses: OperationalStatus[]): OperationalStatus => statuses.reduce((worst, status) => rank[status] > rank[worst] ? status : worst, "actual" as OperationalStatus);
const metric = (value: number | undefined, status: OperationalStatus, missingInputs: string[] = []): Metric => ({ value, status, missingInputs });

export function calculateSalesVelocity(sales?: SalesHistory): Metric {
  if (sales?.unitsSold === undefined || sales.periodDays === undefined || sales.periodDays <= 0) return metric(undefined, "no_data", ["Sales history and a positive period are required"]);
  return metric(sales.unitsSold / sales.periodDays, sales.status);
}

export function calculateStockCoverage(availableStock: number | undefined, velocity: Metric): Metric {
  if (availableStock === undefined) return metric(undefined, "no_data", ["Available stock is required"]);
  if (velocity.value === undefined || velocity.value <= 0) return metric(undefined, velocity.status === "no_data" ? "no_data" : "incomplete", [...velocity.missingInputs, "A positive sales velocity is required"]);
  return metric(availableStock / velocity.value, combineStatus(velocity.status));
}

export function estimateStockoutAt(coverage: Metric, asOf: string): { value?: string; status: OperationalStatus; missingInputs: string[] } {
  if (coverage.value === undefined) return { status: coverage.status, missingInputs: coverage.missingInputs };
  const date = new Date(asOf); if (Number.isNaN(date.getTime())) return { status: "no_data", missingInputs: ["A valid calculation date is required"] };
  date.setUTCDate(date.getUTCDate() + Math.ceil(coverage.value));
  return { value: date.toISOString(), status: coverage.status, missingInputs: [] };
}

export function calculateReorderRecommendation(input: InventoryRecommendationInput): ReorderRecommendation {
  const availableStock = input.inventory?.availableStock ?? input.inventory?.currentStock;
  const velocity = calculateSalesVelocity(input.sales);
  const coverage = calculateStockCoverage(availableStock, velocity);
  const stockout = estimateStockoutAt(coverage, input.calculatedAt);
  const leadTime = input.supplierProduct?.leadTimeDays;
  const missingInputs = Array.from(new Set([...coverage.missingInputs, ...(leadTime === undefined ? ["Supplier lead time is not configured"] : [])]));
  const safetyStock = input.configuration?.safetyStock ?? 0;
  const reviewPeriodDays = input.configuration?.reviewPeriodDays ?? 0;
  const velocityValue = velocity.value;
  const canRecommend = availableStock !== undefined && velocityValue !== undefined && velocityValue > 0 && leadTime !== undefined;
  const reorderPoint = canRecommend ? Math.ceil(velocityValue! * leadTime! + safetyStock) : undefined;
  const rawQuantity = canRecommend ? Math.max(0, Math.ceil(velocityValue! * (leadTime! + reviewPeriodDays) + safetyStock - availableStock!)) : undefined;
  const reorderQuantity = rawQuantity === undefined ? undefined : input.supplierProduct?.moq && rawQuantity > 0 ? Math.max(rawQuantity, input.supplierProduct.moq) : rawQuantity;
  const reorderCost = reorderQuantity === undefined || input.supplierProduct?.unitCost === undefined ? undefined : money(reorderQuantity * input.supplierProduct.unitCost);
  if (reorderQuantity !== undefined && input.supplierProduct?.unitCost === undefined) missingInputs.push("Supplier unit cost is not configured");
  const supplierStatus = input.supplierProduct?.status ?? "no_data";
  const status = missingInputs.length ? "incomplete" : combineStatus(input.inventory?.status ?? "no_data", velocity.status, supplierStatus, input.configuration?.status ?? "actual");
  return { ...input.scope, productId: input.productId, variantId: input.variantId, status, currentStock: input.inventory?.currentStock, availableStock, salesVelocityPerDay: velocity.value, coverageDays: coverage.value, estimatedStockoutAt: stockout.value, reorderPoint, reorderQuantity, supplierId: input.supplierProduct?.supplierId, supplierLeadTimeDays: leadTime, moq: input.supplierProduct?.moq, supplierUnitCost: input.supplierProduct?.unitCost, reorderCost, missingInputs, explanations: ["Velocity uses units sold divided by the selected historical period", "Coverage uses available stock divided by sales velocity", "Reorder quantity covers lead time, configured review period, and configured safety stock", ...(input.supplierProduct?.moq ? ["MOQ raises a positive recommendation when required"] : [])], source: input.source ?? "calculated", calculatedAt: input.calculatedAt };
}

export function calculateCashAwareDecision(input: CashDecisionInput): CashAwareDecision {
  const cash = input.cash; const missingInputs = [...input.recommendation.missingInputs];
  if (cash?.currentCash === undefined) missingInputs.push("Current cash is not configured");
  if (input.recommendation.reorderCost === undefined) missingInputs.push("Reorder cost is incomplete");
  const obligations = cash?.knownImmediateObligations ?? zeroMoney;
  const projectedCash = cash?.currentCash === undefined || input.recommendation.reorderCost === undefined ? undefined : subtractMoney(subtractMoney(cash.currentCash, input.recommendation.reorderCost), obligations);
  const status = missingInputs.length ? "incomplete" : combineStatus(input.recommendation.status, cash?.status ?? "no_data");
  return { ...input.recommendation, id: input.id, recommendation: input.recommendation, status, lifecycle: input.lifecycle, currentCash: cash?.currentCash, reorderCost: input.recommendation.reorderCost, knownImmediateObligations: obligations, projectedCash, cashFloor: cash?.cashFloor, cashFloorStatus: cash?.cashFloor === undefined ? "not_configured" : "configured", missingInputs: Array.from(new Set(missingInputs)), calculatedAt: input.calculatedAt, source: input.source ?? "calculated" };
}
