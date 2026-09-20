import { describe, expect, it } from "vitest";
import { variants } from "../server/db/schema";
import { safeNumber } from "../server/repositories/postgresCommerce";
describe("PostgreSQL Variant persistence contract",()=>{
 it("defines platform-scoped external identity and scoped product parent columns",()=>{expect(variants.platform.name).toBe("platform");expect(variants.externalId.name).toBe("external_id");expect(variants.organizationId.name).toBe("organization_id");expect(variants.storeId.name).toBe("store_id");expect(variants.productId.name).toBe("product_id");});
 it("keeps bigint conversion explicit and safe",()=>{expect(safeNumber(0n)).toBe(0);expect(()=>safeNumber(9007199254740992n)).toThrow("safe integer");});
});
