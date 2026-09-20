import type { MinorUnit } from "./money";
import type { DataScope, Id, Provenance } from "./tenant";
import type { OperationalStatus } from "./inventory";

export type CashFlowDirection = "inflow" | "outflow";
export type CashFlowCategory = "sale" | "receivable" | "supplier_payment" | "shipping_payment" | "advertising_payment" | "subscription" | "refund" | "obligation" | "other";
export interface CashFlowEntry extends DataScope { id: Id; direction: CashFlowDirection; category: CashFlowCategory; amount: MinorUnit; currency: string; occurredAt: string; expected: boolean; source: Provenance; status: OperationalStatus; reference?: string; }
export interface CashFlowProjection extends DataScope { currency: string; openingCash?: MinorUnit; inflows?: MinorUnit; outflows?: MinorUnit; knownObligations?: MinorUnit; obligationsStatus: "provided" | "none_known"; projectedCash?: MinorUnit; horizonStart: string; horizonEnd: string; status: OperationalStatus; missingInputs: string[]; calculatedAt: string; source: Provenance; }
export interface CashFlowRepository { listCashFlowEntries(scope: DataScope, from: string, to: string): Promise<CashFlowEntry[]>; }
