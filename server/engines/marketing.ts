import { addMoney, money, subtractMoney, zeroMoney, type MinorUnit } from "../domain/money";
import type { Order } from "../domain/commerce";
import type { AttributionStatus, CampaignEconomics, MarketingCampaign, OrderAttribution, AdvertisingCostTreatment } from "../domain/marketing";
import type { TrueCostResult } from "./trueCost";

type OrderProfitability = Pick<TrueCostResult, "status" | "trueCost" | "trueProfit">;
export interface CampaignEconomicsInput { campaign: MarketingCampaign; attributions: OrderAttribution[]; orders: Order[]; trueCosts: ReadonlyMap<string, OrderProfitability>; advertisingCostTreatment: AdvertisingCostTreatment; calculatedAt: string; }
const rank: Record<AttributionStatus, number> = { actual: 0, estimated: 1, partial: 2, incomplete: 3, unattributed: 4, no_data: 5 };
const worst = (...statuses: AttributionStatus[]) => statuses.reduce((a, b) => rank[b] > rank[a] ? b : a, "actual" as AttributionStatus);
const allocated = (amount: MinorUnit, shareBps: number) => money(Math.round((amount * shareBps) / 10_000));

export function calculateCampaignEconomics(input: CampaignEconomicsInput): CampaignEconomics {
  const records = input.attributions.filter((item) => item.campaignId === input.campaign.id && item.organizationId === input.campaign.organizationId && item.storeId === input.campaign.storeId);
  const missingInputs: string[] = [];
  if (input.campaign.spend === undefined) missingInputs.push("Campaign spend");
  if (!records.length) missingInputs.push("Attributed orders");
  let currencyMismatch = false; const seen = new Set<string>(); const rows = records.flatMap((attribution) => {
    if (seen.has(attribution.orderId)) { missingInputs.push(`Duplicate attribution for order ${attribution.orderId}`); return []; } seen.add(attribution.orderId);
    const order = input.orders.find((item) => item.id === attribution.orderId && item.organizationId === input.campaign.organizationId && item.storeId === input.campaign.storeId);
    const trueCost = order ? input.trueCosts.get(order.id) : undefined; const share = attribution.shareBps ?? (attribution.attributionModel === "fractional" ? undefined : 10_000);
    if (!order || share === undefined || share < 0 || share > 10_000) { missingInputs.push(`Complete deterministic attribution for order ${attribution.orderId}`); return []; }
    if (order.currency !== input.campaign.currency) { currencyMismatch = true; missingInputs.push(`Currency mismatch for attributed order ${attribution.orderId}`); return []; }
    if (!trueCost || trueCost.status === "incomplete" || trueCost.trueProfit === null) missingInputs.push(`Complete True Cost for attributed order ${attribution.orderId}`);
    return [{ attribution, order, trueCost, share }];
  });
  if (input.advertisingCostTreatment === "unknown") missingInputs.push("Advertising cost treatment in True Cost");
  const revenue = currencyMismatch ? undefined : rows.length ? addMoney(...rows.map(({ order, share }) => allocated(subtractMoney(addMoney(order.merchandiseGross, order.shippingCharged), addMoney(order.discounts, order.refundedAmount)), share))) : undefined;
  const trueCost = currencyMismatch || missingInputs.some((message) => message.startsWith("Complete True Cost")) ? undefined : rows.length ? addMoney(...rows.map(({ trueCost: result, share }) => allocated(result!.trueCost, share))) : undefined;
  const trueProfit = currencyMismatch || missingInputs.some((message) => message.startsWith("Complete True Cost")) ? undefined : rows.length ? addMoney(...rows.map(({ trueCost: result, share }) => allocated(result!.trueProfit!, share))) : undefined;
  const spend = input.campaign.spend; const acquiredCustomers = currencyMismatch ? 0 : new Set(rows.map(({ attribution }) => attribution.customerId).filter(Boolean)).size;
  const profitAfterAdvertising = trueProfit === undefined || spend === undefined || input.advertisingCostTreatment === "unknown" ? undefined : input.advertisingCostTreatment === "included_in_true_cost" ? trueProfit : subtractMoney(trueProfit, spend);
  const statuses = [input.campaign.status, ...records.map((item) => item.status)]; const status = missingInputs.length ? "incomplete" : worst(...statuses);
  return { ...input.campaign, campaignId: input.campaign.id, status, spend, attributedRevenue: revenue, attributedTrueCost: trueCost, attributedTrueProfit: trueProfit, profitAfterAdvertising, marginBps: profitAfterAdvertising === undefined || revenue === undefined || revenue === zeroMoney ? undefined : Math.round((profitAfterAdvertising * 10_000) / revenue), roas: spend === undefined || spend <= zeroMoney || revenue === undefined ? undefined : revenue / spend, cac: spend === undefined || acquiredCustomers === 0 ? undefined : money(Math.round(spend / acquiredCustomers)), acquiredCustomers: acquiredCustomers || undefined, advertisingCostTreatment: input.advertisingCostTreatment, missingInputs: Array.from(new Set(missingInputs)), explanations: [input.advertisingCostTreatment === "included_in_true_cost" ? "Campaign profit uses attributed True Profit without subtracting advertising spend again" : "Campaign profit subtracts campaign spend because advertising is not included in order True Cost", "ROAS and CAC are omitted when their denominators are zero or unavailable"], calculatedAt: input.calculatedAt, source: "calculated" };
}
