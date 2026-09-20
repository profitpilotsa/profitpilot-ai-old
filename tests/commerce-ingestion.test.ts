import { describe, expect, it } from "vitest";
import { normalizeRecord } from "../server/ingestion/commerce";
import { ScopedCommerceRepository } from "../server/repositories/commerce";

const scope = { organizationId: "org-a", storeId: "store-a", mode: "live" as const };
const metadata = { platform: "salla" as const, externalId: "product-1", ingestedAt: "2026-09-20T00:00:00Z" };
describe("canonical commerce ingestion", () => {
  it("normalizes platform facts with deterministic scoped identity and preserves missing values", () => {
    const record = normalizeRecord("product", scope, metadata, { name: "Pima", status: "active", createdAt: metadata.ingestedAt });
    expect(record.record.id).toContain("org-a:store-a:salla:product:product-1"); expect(record.record.sku).toBeUndefined(); expect(record.record.source).toBe("platform");
  });
  it("upserts repeated external records without cross-store reads", () => {
    const repository = new ScopedCommerceRepository(); const first = normalizeRecord("product", scope, metadata, { name: "Pima", status: "active", createdAt: metadata.ingestedAt });
    repository.upsert(first); repository.upsert(normalizeRecord("product", scope, metadata, { name: "Pima updated", status: "active", createdAt: metadata.ingestedAt }));
    expect(repository.list("product", scope)).toHaveLength(1); expect(repository.find("product", scope, metadata.externalId)?.name).toBe("Pima updated");
    expect(repository.find("product", { ...scope, storeId: "store-b" }, metadata.externalId)).toBeUndefined();
  });
  it("rejects records whose canonical scope does not match ingestion scope", () => {
    const repository = new ScopedCommerceRepository(); const record = normalizeRecord("product", scope, metadata, { name: "Pima", status: "active", createdAt: metadata.ingestedAt });
    expect(() => repository.upsert({ ...record, record: { ...record.record, organizationId: "org-b" } })).toThrow("scope");
  });
});
