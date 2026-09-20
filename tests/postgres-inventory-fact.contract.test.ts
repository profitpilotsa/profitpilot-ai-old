import { describe, expect, it } from "vitest";
import { inventoryFacts } from "../server/db/schema";
describe("PostgreSQL Inventory Fact persistence contract",()=>{
 it("uses scoped provider identity and scoped product/variant parents",()=>{for(const column of [inventoryFacts.organizationId,inventoryFacts.storeId,inventoryFacts.platform,inventoryFacts.externalId,inventoryFacts.productId,inventoryFacts.variantId])expect(column).toBeDefined();expect(inventoryFacts.variantId.notNull).toBe(false);});
 it("preserves unknown quantity separately from explicit zero",()=>{expect(inventoryFacts.currentStock.notNull).toBe(false);expect(inventoryFacts.availableStock.notNull).toBe(false);expect(inventoryFacts.currentStock.name).toBe("current_stock");});
 it("keeps provider and ingestion timestamps distinct",()=>{expect(inventoryFacts.sourceUpdatedAt.name).toBe("source_updated_at");expect(inventoryFacts.ingestedAt.name).toBe("ingested_at");});
});
