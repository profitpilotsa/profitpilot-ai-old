import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { costAllocations, costRules, orders } from "../server/db/schema";

const hasScopedReference=(columns:readonly unknown[],foreignColumns:readonly unknown[])=>getTableConfig(costAllocations).foreignKeys.some(key=>{const reference=key.reference();return reference.columns.length===columns.length&&reference.columns.every((column,index)=>column===columns[index])&&reference.foreignColumns.every((column,index)=>column===foreignColumns[index]);});

describe("PostgreSQL Cost Allocation scope contract",()=>{
 it("requires a same-organization/store Cost Rule parent",()=>expect(hasScopedReference([costAllocations.organizationId,costAllocations.storeId,costAllocations.costRuleId],[costRules.organizationId,costRules.storeId,costRules.id])).toBe(true));
 it("requires a same-organization/store Order parent",()=>expect(hasScopedReference([costAllocations.organizationId,costAllocations.storeId,costAllocations.orderId],[orders.organizationId,orders.storeId,orders.id])).toBe(true));
 it("keeps the established required parent references and nullable allocation period",()=>{expect(costAllocations.costRuleId.notNull).toBe(true);expect(costAllocations.orderId.notNull).toBe(true);expect(costAllocations.periodFrom.notNull).toBe(false);expect(costAllocations.periodTo.notNull).toBe(false);});
});
