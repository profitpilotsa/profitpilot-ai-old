import { describe, expect, it } from "vitest";
import { customers } from "../server/db/schema";
describe("PostgreSQL Customer persistence contract",()=>{
 it("uses scoped platform identity columns",()=>{for(const column of [customers.organizationId,customers.storeId,customers.platform,customers.externalId])expect(column).toBeDefined();});
 it("keeps optional customer fields nullable and timestamps distinct",()=>{expect(customers.displayName.notNull).toBe(false);expect(customers.email.notNull).toBe(false);expect(customers.phone.notNull).toBe(false);expect(customers.sourceUpdatedAt.name).toBe("source_updated_at");expect(customers.ingestedAt.name).toBe("ingested_at");});
});
