import type { MinorUnit } from "./money";
import type { DataScope, Id, Provenance } from "./tenant";

export type AttributionStatus = "actual" | "estimated" | "partial" | "incomplete" | "unattributed" | "no_data";
export type AttributionModel = "last_click" | "first_click" | "linear" | "fractional" | "manual" | "unknown";
export type AdvertisingCostTreatment = "included_in_true_cost" | "not_included_in_true_cost" | "unknown";
export interface MarketingCampaign extends DataScope { id: Id; externalId?: string; channel: string; name: string; adSetReference?: string; creativeReference?: string; currency: string; spend?: MinorUnit; dateFrom: string; dateTo: string; source: Provenance; status: AttributionStatus; attributionModel: AttributionModel; confidenceBps?: number; }
export interface OrderAttribution extends DataScope { id: Id; campaignId?: Id; orderId: Id; customerId?: Id; shareBps?: number; source: Provenance; status: AttributionStatus; attributionModel: AttributionModel; attributedAt: string; }
export interface CampaignEconomics extends DataScope { campaignId: Id; status: AttributionStatus; spend?: MinorUnit; attributedRevenue?: MinorUnit; attributedTrueCost?: MinorUnit; attributedTrueProfit?: MinorUnit; profitAfterAdvertising?: MinorUnit; marginBps?: number; roas?: number; cac?: MinorUnit; acquiredCustomers?: number; advertisingCostTreatment: AdvertisingCostTreatment; missingInputs: string[]; explanations: string[]; calculatedAt: string; source: Provenance; }
export interface MarketingRepository { listCampaigns(scope: DataScope, from: string, to: string): Promise<MarketingCampaign[]>; listOrderAttributions(scope: DataScope, from: string, to: string): Promise<OrderAttribution[]>; }
