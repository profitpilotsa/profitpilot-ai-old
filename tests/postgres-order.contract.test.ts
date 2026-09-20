import { describe, expect, it } from "vitest";
import { orders } from "../server/db/schema";
import { safeNumber } from "../server/repositories/postgresCommerce";
describe("PostgreSQL Order persistence contract",()=>{
 it("defines scoped provider identity and optional customer relationship",()=>{for(const column of [orders.organizationId,orders.storeId,orders.platform,orders.externalId,orders.customerId])expect(column).toBeDefined();expect(orders.customerId.notNull).toBe(false);});
 it("preserves explicit money zero and rejects unsafe bigint hydration",()=>{expect(safeNumber(0n)).toBe(0);expect(()=>safeNumber(9007199254740992n)).toThrow("safe integer");});
 it("persists optional tax as nullable bigint without conflating it with zero",()=>{expect(orders.taxAmount.name).toBe("tax_minor");expect(orders.taxAmount.notNull).toBe(false);expect(safeNumber(undefined)).toBeUndefined();expect(safeNumber(0n)).toBe(0);expect(safeNumber(125n)).toBe(125);expect(()=>safeNumber(9007199254740992n)).toThrow("safe integer");});
 it("keeps source and ingestion timestamps distinct",()=>{expect(orders.sourceUpdatedAt.name).toBe("source_updated_at");expect(orders.ingestedAt.name).toBe("ingested_at");expect(orders.merchandiseGross.name).toBe("merchandise_gross_minor");});
});
