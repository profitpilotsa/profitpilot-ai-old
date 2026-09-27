import { describe, expect, it } from "vitest";
import { SallaReadOnlySyncService } from "../server/application/sallaReadOnlySync";

describe("Salla read-only sync", () => {
  it("consumes provider pages sequentially before reporting persisted counts", async () => {
    const calls: string[] = [];
    const page = <T>(records: T[], next?: string) => ({ records, next: next ? { value: next } : undefined });
    const adapter = {
      listProducts: async (_connection: unknown, cursor?: { value?: string }) => { calls.push(`products:${cursor?.value ?? "first"}`); return cursor ? page([]) : page([{ id: "p" }], "two"); },
      listVariants: async () => page([]), listCustomers: async () => page([]), listOrders: async () => page([]),
    };
    const repository = { upsertProduct: async () => { calls.push("persist-product"); } };
    const service = new SallaReadOnlySyncService(adapter as never, repository as never);
    const context = { scope: { organizationId: "org", storeId: "store", mode: "live" }, permissions: ["integration.sync"] };
    const connection = { id: "connection", provider: "salla", scope: context.scope, status: "connected" };
    await expect(service.initialSync(context as never, connection as never)).resolves.toEqual({ products: 1, variants: 0, customers: 0, orders: 0 });
    expect(calls).toEqual(["products:first", "products:two", "persist-product"]);
  });
});
