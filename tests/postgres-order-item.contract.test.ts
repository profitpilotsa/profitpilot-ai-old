import { describe, expect, it } from "vitest";
import { orderItems } from "../server/db/schema";
import { safeNumber } from "../server/repositories/postgresCommerce";
describe("PostgreSQL Order Item persistence contract",()=>{
 it("defines scoped provider identity and scoped parent columns",()=>{for(const column of [orderItems.organizationId,orderItems.storeId,orderItems.platform,orderItems.externalId,orderItems.orderId,orderItems.productId,orderItems.variantId])expect(column).toBeDefined();expect(orderItems.productId.notNull).toBe(false);expect(orderItems.variantId.notNull).toBe(false);});
 it("preserves quantity and explicit zero money safely",()=>{expect(orderItems.quantity.name).toBe("quantity");expect(orderItems.returnedQuantity.name).toBe("returned_quantity");expect(safeNumber(0n)).toBe(0);expect(()=>safeNumber(9007199254740992n)).toThrow("safe integer");});
 it("keeps provider and ingestion timestamps distinct",()=>{expect(orderItems.sourceUpdatedAt.name).toBe("source_updated_at");expect(orderItems.ingestedAt.name).toBe("ingested_at");});
});
