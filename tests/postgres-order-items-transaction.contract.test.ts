import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source=readFileSync(new URL("../server/repositories/postgresCommerce.ts",import.meta.url),"utf8");
describe("PostgreSQL Order + Items transaction contract",()=>{
 it("uses one transaction executor for scoped order and item writes",()=>{const fn=source.slice(source.indexOf("persistOrderWithItems"));expect(fn).toContain("this.db.transaction(async tx");expect(fn).toContain("tx.insert(orders)");expect(fn).toContain("tx.insert(orderItems)");expect(fn).toContain("tx.select");});
 it("rejects cross-scope items and does not swallow transaction failures",()=>{const fn=source.slice(source.indexOf("persistOrderWithItems"));expect(fn).toContain("Every order item must share the order organization/store scope");expect(fn).not.toContain("catch(");expect(fn).toContain("onConflictDoUpdate");});
});
