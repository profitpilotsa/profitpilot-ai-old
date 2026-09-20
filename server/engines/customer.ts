import { addMoney, money, subtractMoney, zeroMoney, type MinorUnit } from "../domain/money";
import type { Customer, CustomerProfitability, CustomerSegment, CustomerSegmentRules } from "../domain/customer";
import type { Order } from "../domain/commerce";
import type { TrueCostResult } from "./trueCost";

type OrderProfitability = Pick<TrueCostResult, "status" | "trueCost" | "trueProfit">;
export interface CustomerAggregationInput { customer: Customer; orders: Order[]; trueCosts: ReadonlyMap<string, OrderProfitability>; calculatedAt: string; rules: CustomerSegmentRules; customerAcquisitionCost?: MinorUnit; }
const daysSince = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function calculateCustomerProfitability(input: CustomerAggregationInput): CustomerProfitability {
  const scopedOrders = input.orders.filter((order) => order.customerId === input.customer.id && order.organizationId === input.customer.organizationId && order.storeId === input.customer.storeId && order.status !== "cancelled");
  if (!scopedOrders.length) return { ...input.customer, customerId: input.customer.id, status: "no_data", orderCount: 0, segments: [], explanations: ["No scoped orders are available for this customer"], missingInputs: ["Customer order history"], calculatedAt: input.calculatedAt, source: "calculated" };
  const revenue = addMoney(...scopedOrders.map((order) => subtractMoney(addMoney(order.merchandiseGross, order.shippingCharged), addMoney(order.discounts, order.refundedAmount))));
  const discounts = addMoney(...scopedOrders.map((order) => order.discounts)); const refunds = addMoney(...scopedOrders.map((order) => order.refundedAmount));
  const matched = scopedOrders.map((order) => input.trueCosts.get(order.id)); const missingInputs: string[] = [];
  if (matched.some((result) => !result || result.status === "incomplete" || result.status === "no_data" || result.trueProfit === null)) missingInputs.push("Complete True Cost results for every customer order");
  const trueCost = missingInputs.length ? undefined : addMoney(...matched.map((result) => result!.trueCost));
  const trueProfit = missingInputs.length ? undefined : addMoney(...matched.map((result) => result!.trueProfit!));
  const orderedDates = scopedOrders.map((order) => order.orderedAt).sort(); const firstOrderAt = orderedDates[0]; const lastOrderAt = orderedDates[orderedDates.length - 1];
  const segments = segmentsFor({ orderCount: scopedOrders.length, lastOrderAt, revenue, trueProfit, discounts, rules: input.rules });
  const status = missingInputs.length ? "incomplete" : matched.some((result) => result?.status === "estimated") || input.customer.status === "estimated" ? "estimated" : "actual";
  return { ...input.customer, customerId: input.customer.id, status, orderCount: scopedOrders.length, firstOrderAt, lastOrderAt, historicalRevenue: revenue, discounts, refunds, attributedTrueCost: trueCost, trueProfit, marginBps: trueProfit === undefined || revenue === zeroMoney ? undefined : Math.round((trueProfit * 10_000) / revenue), averageOrderValue: money(Math.round(revenue / scopedOrders.length)), averageTrueProfitPerOrder: trueProfit === undefined ? undefined : money(Math.round(trueProfit / scopedOrders.length)), customerAcquisitionCost: input.customerAcquisitionCost, observedCustomerValue: trueProfit, segments, explanations: ["Observed customer value is historical True Profit, not a forecast", "Segments use explicit rules supplied to this calculation"], missingInputs, calculatedAt: input.calculatedAt, source: "calculated" };
}

function segmentsFor(input: { orderCount: number; lastOrderAt?: string; revenue: MinorUnit; trueProfit?: MinorUnit; discounts: MinorUnit; rules: CustomerSegmentRules }): CustomerSegment[] {
  const segments: CustomerSegment[] = [input.orderCount > 1 ? "returning" : "new"];
  if (input.orderCount > 1) segments.push("repeat_buyer");
  if (input.trueProfit !== undefined && input.rules.highValueTrueProfit !== undefined && input.trueProfit >= input.rules.highValueTrueProfit) segments.push("high_value");
  if (input.trueProfit !== undefined && input.rules.highProfitTrueProfit !== undefined && input.trueProfit >= input.rules.highProfitTrueProfit) segments.push("high_profit");
  if (input.lastOrderAt && input.rules.atRiskAfterDays !== undefined && daysSince(input.lastOrderAt, input.rules.referenceDate) >= input.rules.atRiskAfterDays) segments.push("at_risk");
  if (input.trueProfit !== undefined && input.revenue > zeroMoney && input.rules.highRevenueLowProfitMarginBps !== undefined && Math.round((input.trueProfit * 10_000) / input.revenue) <= input.rules.highRevenueLowProfitMarginBps) segments.push("high_revenue_low_profit");
  if (input.revenue > zeroMoney && input.rules.discountSensitiveBps !== undefined && Math.round((input.discounts * 10_000) / input.revenue) >= input.rules.discountSensitiveBps) segments.push("discount_sensitive");
  return segments;
}
