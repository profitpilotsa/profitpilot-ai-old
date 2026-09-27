import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("Phase 1 migration contracts", () => {
  const sql = readFileSync("server/db/migrations/0001_phase1_security_foundation.sql", "utf8");
  it("is additive, keeps browser roles away from application tables, and enables RLS", () => {
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(sql).toContain("REVOKE ALL ON TABLE");
    expect(sql).toContain('ALTER TABLE "products" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY "pp_products_member_read"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "oauth_states"');
  });
});
