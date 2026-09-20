import { describe, expect, it } from "vitest";
import { customers, inventoryFacts, orderItems, orders, products, variants } from "../server/db/schema";
const tables=[products,variants,customers,orders,orderItems,inventoryFacts];
describe("PostgreSQL canonical persistence identity contract",()=>{
 it("keeps platform identity separate from organization and store across all entities",()=>{for(const table of tables)for(const column of [table.organizationId,table.storeId,table.platform,table.externalId])expect(column).toBeDefined();});
 it("uses nullable inventory quantities so unknown is not manufactured as zero",()=>{for(const column of [inventoryFacts.currentStock,inventoryFacts.availableStock,inventoryFacts.reservedStock,inventoryFacts.inboundStock])expect(column.notNull).toBe(false);});
});
