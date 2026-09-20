import { describe, expect, it } from "vitest";
import { products } from "../server/db/schema";
describe("PostgreSQL Product persistence contract",()=>{
 it("defines scoped platform identity and nullable source metadata",()=>{for(const column of [products.organizationId,products.storeId,products.platform,products.externalId])expect(column).toBeDefined();expect(products.sku.notNull).toBe(false);expect(products.sourceUpdatedAt.name).toBe("source_updated_at");expect(products.ingestedAt.name).toBe("ingested_at");});
});
