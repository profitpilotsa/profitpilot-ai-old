export type ServerResult<T> = { data: T; requestId: string };
export type WorkspaceRequest = { accessToken: string; organizationId: string; storeId: string; platform: string; mode: "demo" | "live" };
export type ServerProduct = { id: string; name: string; sku?: string; status: string; sourceUpdatedAt?: string };

/** Browser boundary: accepts a user session token only, never database/provider credentials. */
export async function loadServerProducts(input: WorkspaceRequest): Promise<ServerResult<ServerProduct[]>> {
  const response = await fetch("/api/v1/commerce/products", { headers: { authorization: `Bearer ${input.accessToken}`, "x-profitpilot-organization": input.organizationId, "x-profitpilot-store": input.storeId, "x-profitpilot-platform": input.platform, "x-profitpilot-mode": input.mode } });
  if (!response.ok) throw new Error("Server product data is unavailable");
  return response.json() as Promise<ServerResult<ServerProduct[]>>;
}
