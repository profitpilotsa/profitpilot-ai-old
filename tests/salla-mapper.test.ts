import { describe, expect, it } from "vitest";
import { SallaCanonicalMapper, canonicalId } from "../server/integrations/sallaMapper";

const scope = { organizationId: "org", storeId: "store", mode: "live" as const };
describe("Salla canonical mapper", () => {
  it("uses stable internal identities and leaves undocumented values missing", () => {
    const mapper = new SallaCanonicalMapper(scope);
    const product = mapper.product({ id: 10, name: "Shirt", status: "sale" });
    const variant = mapper.variant(10, { id: 11, sku: "M" });
    expect(product.id).toBe(canonicalId(scope, "product", "10")); expect(product.createdAt).toBeUndefined();
    expect(variant.id).not.toBe("11"); expect(variant.productId).toBe(product.id); expect(variant.name).toBeUndefined();
  });
  it("does not fabricate order-level or item-level information", () => {
    const mapper = new SallaCanonicalMapper(scope);
    const order = mapper.order({ id: 12, status: { slug: "unexpected" }, currency: "SAR", amounts: { sub_total: { amount: "10.50", currency: "SAR" }, shipping_cost: { amount: 0 }, discounts: [] }, payment_actions: { refund_action: { refund_amount: { amount: 0 } } }, date: { date: "2026-01-01T00:00:00Z" } });
    const item = mapper.orderItem(12, { id: 13, name: "Shirt", quantity: 1, amounts: { total: { amount: "10.50" }, total_discount: { amount: 0 } } });
    expect(order.status).toBe("unknown"); expect(order.taxAmount).toBeUndefined(); expect(order.discounts).toBe(0);
    expect(item.productId).toBeUndefined(); expect(item.variantId).toBeUndefined(); expect(item.unitGross).toBe(1050);
  });
  it("does not reinterpret a timezone-less Salla timestamp as an absolute instant", () => {
    const mapper = new SallaCanonicalMapper(scope);
    expect(mapper.product({ id: 14, name: "Shirt", updated_at: "2026-01-01 12:00:00" }).sourceUpdatedAt).toBeUndefined();
  });
});
