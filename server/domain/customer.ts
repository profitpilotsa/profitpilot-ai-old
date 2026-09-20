import type { MinorUnit } from "./money";
import type { DataScope, Id, Provenance } from "./tenant";
import type { OperationalStatus } from "./inventory";

export type CustomerSegment = "new" | "returning" | "high_value" | "at_risk" | "repeat_buyer" | "high_revenue_low_profit" | "high_profit" | "discount_sensitive";
export interface Customer extends DataScope { id: Id; externalId?: string; source: Provenance; displayName?: string; email?: string; phone?: string; status: OperationalStatus; createdAt?: string; }
export interface CustomerSegmentRules { referenceDate: string; highValueTrueProfit?: MinorUnit; highProfitTrueProfit?: MinorUnit; atRiskAfterDays?: number; highRevenueLowProfitMarginBps?: number; discountSensitiveBps?: number; }
export interface CustomerProfitability extends DataScope { customerId: Id; status: OperationalStatus; orderCount: number; firstOrderAt?: string; lastOrderAt?: string; historicalRevenue?: MinorUnit; discounts?: MinorUnit; refunds?: MinorUnit; attributedTrueCost?: MinorUnit; trueProfit?: MinorUnit; marginBps?: number; averageOrderValue?: MinorUnit; averageTrueProfitPerOrder?: MinorUnit; customerAcquisitionCost?: MinorUnit; observedCustomerValue?: MinorUnit; estimatedLtv?: MinorUnit; segments: CustomerSegment[]; explanations: string[]; missingInputs: string[]; calculatedAt: string; source: Provenance; }
export interface CustomerRepository { findCustomer(scope: DataScope, id: Id): Promise<Customer | undefined>; listCustomers(scope: DataScope): Promise<Customer[]>; }
