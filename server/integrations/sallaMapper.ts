import { createHash } from "node:crypto";
import type { Customer } from "../domain/customer";
import type { Order, OrderItem, Product, ProductStatus, Variant } from "../domain/commerce";
import type { DataScope, Id } from "../domain/tenant";

/**
 * Maps Salla's read responses to the canonical model without filling in data
 * which Salla did not return.  It deliberately has no HTTP or database access.
 */
export class SallaCanonicalMapper {
  constructor(private readonly scope: DataScope) {
    if (scope.mode !== "live") throw new Error("Salla mapping is only permitted for a live scope");
  }

  product(value: SallaProductRecord): Product {
    const externalId = requiredId(value.id, "product");
    return {
      ...this.scope, id: canonicalId(this.scope, "product", externalId), externalId,
      source: "platform", sourceStatus: text(value.status), name: requiredText(value.name, "product name"),
      sku: text(value.sku), status: productStatus(value.status),
      sourceUpdatedAt: iso(value.updated_at),
    };
  }

  variant(productExternalId: string | number, value: SallaVariantRecord): Variant {
    const externalId = requiredId(value.id, "variant");
    const parentExternalId = requiredId(productExternalId, "variant product");
    return {
      ...this.scope, id: canonicalId(this.scope, "variant", externalId), externalId,
      productId: canonicalId(this.scope, "product", parentExternalId), source: "platform",
      sourceStatus: text(value.status), name: text(value.name), sku: text(value.sku),
      status: productStatus(value.status), sourceUpdatedAt: iso(value.updated_at),
    };
  }

  customer(value: SallaCustomerRecord): Customer {
    const externalId = requiredId(value.id, "customer");
    return {
      ...this.scope, id: canonicalId(this.scope, "customer", externalId), externalId, source: "platform",
      displayName: text(value.name) ?? joinName(value.first_name, value.last_name), email: text(value.email), phone: textOrNumber(value.mobile ?? value.phone),
      status: "actual", sourceUpdatedAt: iso(value.updated_at),
    };
  }

  order(value: SallaOrderRecord): Order {
    const externalId = requiredId(value.id, "order");
    const amounts = value.amounts;
    if (!Array.isArray(amounts?.discounts)) throw new Error("Salla order discounts are required");
    const discounts = amounts.discounts.reduce((sum, discount) => sum + money(discount.discount, "order discount"), 0);
    return {
      ...this.scope, id: canonicalId(this.scope, "order", externalId), externalId,
      customerId: this.optionalCanonicalId(value.customer?.id, "customer"), source: "platform",
      sourceStatus: text(value.status?.slug ?? value.status), status: orderStatus(value.status?.slug ?? value.status),
      currency: requiredText(amounts?.sub_total?.currency ?? value.currency, "order currency"),
      merchandiseGross: money(amounts?.sub_total?.amount, "order merchandise subtotal"), discounts,
      taxAmount: optionalMoney(amounts?.tax?.amount?.amount), shippingCharged: money(amounts?.shipping_cost?.amount, "order shipping cost"),
      refundedAmount: money(value.payment_actions?.refund_action?.refund_amount?.amount, "order refund amount"), revenueBasis: "unknown",
      orderedAt: requiredIso(value.date?.date ?? value.created_at, "order date"), sourceUpdatedAt: iso(value.updated_at),
    };
  }

  orderItem(orderExternalId: string | number, value: SallaOrderItemRecord): OrderItem {
    const externalId = requiredId(value.id, "order item");
    const productId = this.optionalCanonicalId(value.product_id ?? value.product?.id, "product");
    const variantId = this.optionalCanonicalId(value.variant_id ?? value.variant?.id, "variant");
    const quantitySold = quantity(value.quantity, "order item quantity");
    const lineTotal = money(value.amounts?.total?.amount, "order item total");
    if (lineTotal % quantitySold !== 0) throw new Error("Salla order item total cannot be represented as exact minor-unit price");
    return {
      ...this.scope, id: canonicalId(this.scope, "order-item", externalId), externalId,
      orderId: canonicalId(this.scope, "order", requiredId(orderExternalId, "order item order")),
      productId, variantId, source: "platform", title: requiredText(value.name ?? value.title, "order item title"),
      quantity: quantitySold, returnedQuantity: optionalQuantity(value.returned_quantity) ?? 0,
      unitGross: lineTotal / quantitySold,
      discountAmount: money(value.amounts?.total_discount?.amount, "order item discount"),
      sourceUpdatedAt: iso(value.updated_at),
    };
  }

  private optionalCanonicalId(value: unknown, entity: string): Id | undefined {
    return value === undefined || value === null || value === "" ? undefined : canonicalId(this.scope, entity, requiredId(value, entity));
  }
}

/** Stable UUID identity: provider identifiers never become internal IDs. */
export function canonicalId(scope: Pick<DataScope, "organizationId" | "storeId">, entity: string, externalId: string): Id {
  const bytes = createHash("sha256").update(`salla:${scope.organizationId}:${scope.storeId}:${entity}:${externalId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type SallaProductRecord = { id: string | number; name?: unknown; sku?: unknown; status?: unknown; updated_at?: unknown };
export type SallaVariantRecord = { id: string | number; name?: unknown; sku?: unknown; status?: unknown; updated_at?: unknown };
export type SallaCustomerRecord = { id: string | number; name?: unknown; first_name?: unknown; last_name?: unknown; email?: unknown; mobile?: unknown; phone?: unknown; updated_at?: unknown };
export type SallaOrderRecord = { id: string | number; status?: unknown; currency?: unknown; amounts?: { sub_total?: { amount?: unknown; currency?: unknown }; shipping_cost?: { amount?: unknown }; tax?: { amount?: { amount?: unknown } }; discounts?: { discount?: unknown }[] }; date?: { date?: unknown; timezone?: unknown }; created_at?: unknown; updated_at?: unknown; customer?: { id?: unknown }; payment_actions?: { refund_action?: { refund_amount?: { amount?: unknown } } } };
export type SallaOrderItemRecord = { id: string | number; name?: unknown; title?: unknown; product_id?: unknown; product?: { id?: unknown }; variant_id?: unknown; variant?: { id?: unknown }; quantity?: unknown; returned_quantity?: unknown; amounts?: { total?: { amount?: unknown }; total_discount?: { amount?: unknown } }; updated_at?: unknown };

function productStatus(value: unknown): ProductStatus { return text(value) === "sale" ? "active" : "unknown"; }
function orderStatus(value: unknown): Order["status"] { const normalized = text(value)?.toLowerCase(); return ["pending", "paid", "fulfilled", "cancelled", "refunded", "partially_refunded", "returned"].includes(normalized ?? "") ? normalized as Order["status"] : "unknown"; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function textOrNumber(value: unknown): string | undefined { return text(value) ?? (typeof value === "number" && Number.isFinite(value) ? String(value) : undefined); }
function requiredText(value: unknown, label: string): string { const result = text(value); if (!result) throw new Error(`Salla ${label} is required`); return result; }
function requiredId(value: unknown, label: string): string { if ((typeof value !== "string" && typeof value !== "number") || !String(value).trim()) throw new Error(`Salla ${label} ID is required`); return String(value); }
/** A provider date without UTC offset is not silently reinterpreted in server local time. */
function iso(value: unknown): string | undefined { const raw = typeof value === "string" ? value : value && typeof value === "object" && "date" in value ? (value as { date?: unknown }).date : undefined; const zone = value && typeof value === "object" && "timezone" in value ? (value as { timezone?: unknown }).timezone : undefined; const absolute = typeof raw === "string" && /(?:Z|[+-]\d\d:\d\d)$/i.test(raw) ? raw : typeof raw === "string" && zone === "Asia/Riyadh" ? `${raw.replace(" ", "T")}+03:00` : undefined; if (!absolute) return undefined; const date = new Date(absolute); return Number.isNaN(date.getTime()) ? undefined : date.toISOString(); }
function joinName(first: unknown, last: unknown): string | undefined { const result = [text(first), text(last)].filter((part): part is string => Boolean(part)).join(" "); return result || undefined; }
function requiredIso(value: unknown, label: string): string { const result = iso(value); if (!result) throw new Error(`Salla ${label} is required`); return result; }
function quantity(value: unknown, label: string): number { const numeric = typeof value === "number" ? value : Number(value); if (!Number.isSafeInteger(numeric) || numeric < 0) throw new Error(`Salla ${label} must be a non-negative safe integer`); return numeric; }
function optionalQuantity(value: unknown): number | undefined { return value === undefined || value === null ? undefined : quantity(value, "returned quantity"); }
function money(value: unknown, label: string): number { const result = optionalMoney(value); if (result === undefined) throw new Error(`Salla ${label} is required`); return result; }
function optionalMoney(value: unknown): number | undefined { if (value === undefined || value === null || value === "") return undefined; const string = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : undefined; if (!string || !/^-?\d+(\.\d{1,2})?$/.test(string)) throw new Error("Salla money must be a decimal amount with at most two places"); const [whole, fraction = ""] = string.split("."); const minor = Number(whole) * 100 + (Number(fraction.padEnd(2, "0")) * (whole.startsWith("-") ? -1 : 1)); if (!Number.isSafeInteger(minor)) throw new Error("Salla money exceeds safe minor-unit range"); return minor; }
