import { money, subtractMoney, zeroMoney, type MinorUnit } from "../domain/money";
import type { CashAwareDecision, CashPosition, InventoryState, OperationalStatus, ReorderConfiguration, ReorderRecommendation, SalesHistory, SupplierProduct } from "../domain/inventory";
import type { DataScope, Id, Provenance } from "../domain/tenant";

export interface Metric { value?: number; status: OperationalStatus; missingInputs: string[]; }
export interface InventoryRecommendationInput { scope: DataScope; productId: Id; variantId?: Id; inventory?: InventoryState; sales?: SalesHistory; supplierProduct?: SupplierProduct; configuration?: ReorderConfiguration; calculatedAt: string; source?: Provenance; }
export interface CashDecisionInput { id: Id; lifecycle: CashAwareDecision["lifecycle"]; recommendation: ReorderRecommendation; cash?: CashPosition; calculatedAt: string; source?: Provenance; }

const rank: Record<OperationalStatus, number> = { actual: 0, estimated: 1, incomplete: 2, no_data: 3 };
const combineStatus = (...statuses: OperationalStatus[]): OperationalStatus => statuses.reduce((worst, status) => rank[status] > rank[worst] ? status : worst, "actual" as OperationalStatus);
const metric = (value: number | undefined, status: OperationalStatus, missingInputs: string[] = []): Metric => ({ value, status, missingInputs });
const isNonNegativeFinite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value >= 0;
const isPositiveFinite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value > 0;
const isValidMinorUnit = (value: MinorUnit | undefined): value is MinorUnit => value !== undefined && Number.isSafeInteger(value) && value >= 0;
const sharesScope = (scope: DataScope, record: DataScope) => record.organizationId === scope.organizationId && record.storeId === scope.storeId;

export function calculateSalesVelocity(sales?: SalesHistory): Metric {
  if (sales?.unitsSold === undefined || sales.periodDays === undefined) return metric(undefined, "no_data", ["Sales history and a positive period are required"]);
  if (!isNonNegativeFinite(sales.unitsSold)) return metric(undefined, "incomplete", ["Units sold must be a non-negative finite number"]);
  if (!isPositiveFinite(sales.periodDays)) return metric(undefined, "incomplete", ["Sales period must be a positive finite number of days"]);
  return metric(sales.unitsSold / sales.periodDays, sales.status);
}

export function calculateStockCoverage(availableStock: number | undefined, velocity: Metric): Metric {
  if (availableStock === undefined) return metric(undefined, "no_data", ["Available stock is required"]);
  if (!isNonNegativeFinite(availableStock)) return metric(undefined, "incomplete", ["Available stock must be a non-negative finite number"]);
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
  if ([input.inventory, input.sales, input.supplierProduct, input.configuration].some(record => record !== undefined && !sharesScope(input.scope, record))) return { ...input.scope, productId: input.productId, variantId: input.variantId, status: "incomplete", missingInputs: ["Tenant/store scope mismatch in inventory inputs"], explanations: ["Inventory inputs must belong to the requested organization and store"], source: input.source ?? "calculated", calculatedAt: input.calculatedAt };
  const availableStock = input.inventory?.availableStock ?? input.inventory?.currentStock;
  const velocity = calculateSalesVelocity(input.sales);
  const coverage = calculateStockCoverage(availableStock, velocity);
  const stockout = estimateStockoutAt(coverage, input.calculatedAt);
  const leadTime = input.supplierProduct?.leadTimeDays;
  const safetyStock = input.configuration?.safetyStock ?? 0;
  const reviewPeriodDays = input.configuration?.reviewPeriodDays ?? 0;
  const supplierCost = input.supplierProduct?.unitCost;
  const supplierMoq = input.supplierProduct?.moq;
  const leadTimeValid = isNonNegativeFinite(leadTime);
  const safetyStockValid = isNonNegativeFinite(safetyStock);
  const reviewPeriodValid = isNonNegativeFinite(reviewPeriodDays);
  const costValid = supplierCost === undefined || isValidMinorUnit(supplierCost);
  const moqValid = supplierMoq === undefined || isNonNegativeFinite(supplierMoq);
  const missingInputs = Array.from(new Set([...coverage.missingInputs, ...(leadTime === undefined ? ["Supplier lead time is not configured"] : !leadTimeValid ? ["Supplier lead time must be a non-negative finite number"] : []), ...(!safetyStockValid ? ["Safety stock must be a non-negative finite number"] : []), ...(!reviewPeriodValid ? ["Review period must be a non-negative finite number of days"] : []), ...(!costValid ? ["Supplier unit cost must be a non-negative minor-unit value"] : []), ...(!moqValid ? ["Supplier MOQ must be a non-negative finite number"] : [])]));
  const velocityValue = velocity.value;
  const canRecommend = isNonNegativeFinite(availableStock) && isPositiveFinite(velocityValue) && leadTimeValid && safetyStockValid && reviewPeriodValid;
  const reorderPoint = canRecommend ? Math.ceil(velocityValue! * leadTime! + safetyStock) : undefined;
  const rawQuantity = canRecommend ? Math.max(0, Math.ceil(velocityValue! * (leadTime! + reviewPeriodDays) + safetyStock - availableStock!)) : undefined;
  const reorderQuantity = rawQuantity === undefined ? undefined : supplierMoq !== undefined && supplierMoq > 0 && rawQuantity > 0 && moqValid ? Math.max(rawQuantity, Math.ceil(supplierMoq)) : rawQuantity;
  const reorderCost = reorderQuantity === undefined || supplierCost === undefined || !costValid ? undefined : money(reorderQuantity * supplierCost);
  if (reorderQuantity !== undefined && supplierCost === undefined) missingInputs.push("Supplier unit cost is not configured");
  const supplierStatus = input.supplierProduct?.status ?? "no_data";
  const status = missingInputs.length ? "incomplete" : combineStatus(input.inventory?.status ?? "no_data", velocity.status, supplierStatus, input.configuration?.status ?? "actual");
  return { ...input.scope, productId: input.productId, variantId: input.variantId, status, currentStock: input.inventory?.currentStock, availableStock, salesVelocityPerDay: velocity.value, coverageDays: coverage.value, estimatedStockoutAt: stockout.value, reorderPoint, reorderQuantity, supplierId: input.supplierProduct?.supplierId, supplierLeadTimeDays: leadTime, moq: supplierMoq, supplierUnitCost: supplierCost, currency: input.supplierProduct?.currency, reorderCost, missingInputs, explanations: ["Velocity uses units sold divided by the selected historical period", "Coverage uses available stock divided by sales velocity", "Reorder quantity covers lead time, configured review period, and configured safety stock", ...(supplierMoq ? ["MOQ raises a positive recommendation when required; it is not treated as a case-pack multiple"] : [])], source: input.source ?? "calculated", calculatedAt: input.calculatedAt };
}

export function calculateCashAwareDecision(input: CashDecisionInput): CashAwareDecision {
  const cash = input.cash; const missingInputs = [...input.recommendation.missingInputs];
  if (!isValidMinorUnit(cash?.currentCash)) missingInputs.push(cash?.currentCash === undefined ? "Current cash is not configured" : "Current cash must be a non-negative minor-unit value");
  if (input.recommendation.reorderCost === undefined) missingInputs.push("Reorder cost is incomplete");
  if (cash?.knownImmediateObligations !== undefined && !isValidMinorUnit(cash.knownImmediateObligations)) missingInputs.push("Known immediate obligations must be a non-negative minor-unit value");
  if (cash?.cashFloor !== undefined && !isValidMinorUnit(cash.cashFloor)) missingInputs.push("Cash floor must be a non-negative minor-unit value");
  if (cash?.currency && input.recommendation.currency && cash.currency !== input.recommendation.currency) missingInputs.push("Cash and supplier currencies do not match");
  const obligations = cash?.knownImmediateObligations ?? zeroMoney;
  const projectedCash = !isValidMinorUnit(cash?.currentCash) || input.recommendation.reorderCost === undefined || (cash?.knownImmediateObligations !== undefined && !isValidMinorUnit(cash.knownImmediateObligations)) || (cash?.currency && input.recommendation.currency && cash.currency !== input.recommendation.currency) ? undefined : subtractMoney(subtractMoney(cash.currentCash, input.recommendation.reorderCost), obligations);
  const status = missingInputs.length ? "incomplete" : combineStatus(input.recommendation.status, cash?.status ?? "no_data");
  return { ...input.recommendation, id: input.id, recommendation: input.recommendation, status, lifecycle: input.lifecycle, currentCash: cash?.currentCash, reorderCost: input.recommendation.reorderCost, knownImmediateObligations: cash?.knownImmediateObligations, obligationsStatus: cash?.knownImmediateObligations === undefined ? "none_known" : "provided", projectedCash, cashFloor: cash?.cashFloor, cashFloorStatus: cash?.cashFloor === undefined ? "not_configured" : "configured", missingInputs: Array.from(new Set(missingInputs)), calculatedAt: input.calculatedAt, source: input.source ?? "calculated" };
}
