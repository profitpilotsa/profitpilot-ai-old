import { describe, expect, it } from "vitest";
import { SallaHttpReadClient } from "../server/integrations/sallaHttpReadClient";

const scope = { organizationId: "org", storeId: "store", mode: "live" as const };
const connection = { id: "connection", provider: "salla" as const, status: "connected" as const, scope };
describe("Salla HTTP read client", () => {
  it("uses only GET requests, paginates by page, and never exposes the bearer token in an error", async () => {
    const calls: { url: string; method?: string; auth?: string }[] = [];
    const request = async (url: URL, init?: RequestInit) => { calls.push({ url: url.toString(), method: init?.method, auth: new Headers(init?.headers).get("authorization") ?? undefined }); return new Response(JSON.stringify({ data: [{ id: 1, name: "Shirt", status: "sale" }], pagination: { currentPage: 1, totalPages: 2 } }), { status: 200 }); };
    const client = new SallaHttpReadClient(scope, "private-token", request as typeof fetch);
    await expect(client.products(connection)).resolves.toMatchObject({ records: [{ externalId: "1", name: "Shirt" }], next: { value: "2" } });
    expect(calls).toEqual([{ url: "https://api.salla.dev/admin/v2/products?per_page=30", method: "GET", auth: "Bearer private-token" }]);
  });
});
