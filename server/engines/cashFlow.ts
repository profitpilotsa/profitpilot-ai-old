import { addMoney, subtractMoney, zeroMoney, type MinorUnit } from "../domain/money";
import type { CashFlowEntry, CashFlowProjection } from "../domain/cashFlow";
import type { DataScope, Provenance } from "../domain/tenant";

export interface CashFlowInput { scope: DataScope; currency: string; openingCash?: MinorUnit; entries: CashFlowEntry[]; knownObligations?: MinorUnit; obligationsKnown?: boolean; horizonStart: string; horizonEnd: string; calculatedAt: string; source?: Provenance; }
export function calculateCashFlow(input: CashFlowInput): CashFlowProjection {
  const missingInputs: string[] = []; if (input.openingCash === undefined) missingInputs.push("Opening cash balance");
  const scoped = input.entries.filter((entry) => entry.organizationId === input.scope.organizationId && entry.storeId === input.scope.storeId && entry.occurredAt >= input.horizonStart && entry.occurredAt <= input.horizonEnd);
  if (scoped.some((entry) => entry.currency !== input.currency)) missingInputs.push("Currency conversion for cash-flow entries");
  const safe = scoped.filter((entry) => entry.currency === input.currency); const inflows = addMoney(...safe.filter((entry) => entry.direction === "inflow").map((entry) => entry.amount)); const outflows = addMoney(...safe.filter((entry) => entry.direction === "outflow" && entry.category !== "obligation").map((entry) => entry.amount));
  const obligationsUnavailable = input.obligationsKnown === false;
  if (obligationsUnavailable) missingInputs.push(input.knownObligations === undefined ? "Known obligations are unavailable" : "Known obligations were supplied while obligations are marked unknown");
  const obligationsStatus = input.obligationsKnown ? "provided" : "none_known"; const obligations = input.obligationsKnown ? input.knownObligations ?? zeroMoney : zeroMoney;
  const projectedCash = input.openingCash === undefined || obligationsUnavailable || missingInputs.some((item) => item.startsWith("Currency")) ? undefined : subtractMoney(addMoney(input.openingCash, inflows), addMoney(outflows, obligations));
  const status = missingInputs.length ? "incomplete" : safe.some((entry) => entry.expected || entry.status === "estimated") ? "estimated" : "actual";
  return { ...input.scope, currency: input.currency, openingCash: input.openingCash, inflows, outflows, knownObligations: input.obligationsKnown ? obligations : undefined, obligationsStatus, projectedCash, horizonStart: input.horizonStart, horizonEnd: input.horizonEnd, status, missingInputs, calculatedAt: input.calculatedAt, source: input.source ?? "calculated" };
}
