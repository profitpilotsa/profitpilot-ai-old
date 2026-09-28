import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProfitPilotApi } from "../server/http/app";
import { SupabaseAuthVerifier } from "../server/foundation/auth";
import { parseMode, parseRole, ROLE_PERMISSIONS, type Role, type Mode } from "../server/phase1";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
});

type Options = { auth?: string | null; org?: string; store?: string; mode?: string | null; role?: unknown; orgMode?: Mode; status?: "active" | "demo"; query?: string; missingUser?: boolean; wrongSubject?: boolean; wrongStore?: boolean; failure?: boolean; method?: string };
async function exercise(options: Options = {}) {
  const listProducts = vi.fn(async () => []);
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (options.failure) throw new Error("SYNTHETIC_PRIVATE_INTERNAL_DETAIL");
    const valid = (init?.headers as Record<string, string>).authorization === "Bearer synthetic-user-a";
    return new Response(JSON.stringify(valid ? { id: "subject-a" } : {}), { status: valid ? 200 : 401 });
  });
  const auth = new SupabaseAuthVerifier(fetcher, { SUPABASE_URL: "https://auth.invalid", SUPABASE_ANON_KEY: "synthetic-public-key" });
  const findUserBySubject = vi.fn(async () => options.missingUser ? undefined : ({ id: "user-a", externalSubject: options.wrongSubject ? "subject-b" : "subject-a" }));
  const app = createProfitPilotApi(() => ({ auth, commerce: { listProducts }, tenants: {
    findUserBySubject,
    findMembership: async (user, org) => user === "user-a" && org === "org-a" ? { userId: user, organizationId: org, role: (Object.hasOwn(options, "role") ? options.role : "viewer") as Role } : undefined,
    findOrganization: async org => ["org-a", "org-b"].includes(org) ? { id: org, name: org, defaultCurrency: "SAR", mode: options.orgMode ?? "live" } : undefined,
    findStore: async (org, store) => ((org === "org-a" && store === "store-a") || (org === "org-b" && store === "store-b")) ? { id: options.wrongStore ? "store-other" : store, organizationId: org, name: store, platform: "salla", status: options.status ?? "active" } : undefined,
  } }));
  const server = createServer(app); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP listener");
  const headers: Record<string, string> = { "x-profitpilot-organization": options.org ?? "org-a", "x-profitpilot-store": options.store ?? "store-a", "x-profitpilot-platform": "salla", "x-request-id": "task3-test" };
  if (options.auth !== null) headers.authorization = options.auth ?? "Bearer synthetic-user-a";
  if (options.mode !== null) headers["x-profitpilot-mode"] = options.mode ?? "live";
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/commerce/products${options.query ?? ""}`, { headers, method: options.method ?? "GET" });
  const body = await response.text();
  expect(body).not.toContain("SYNTHETIC_PRIVATE_INTERNAL_DETAIL");
  expect(body).not.toContain("synthetic-user-a");
  return { response, body, listProducts, fetcher, findUserBySubject };
}

describe("Task 3 actual HTTP authorization path", () => {
  const denied: [string, Options, number, string][] = [
    ["no authentication", { auth: null }, 401, "UNAUTHORIZED"],
    ["malformed authentication", { auth: "Basic synthetic" }, 401, "UNAUTHORIZED"],
    ["empty bearer", { auth: "Bearer " }, 401, "UNAUTHORIZED"],
    ["rejected authentication", { auth: "Bearer rejected" }, 401, "UNAUTHORIZED"],
    ["no canonical user", { missingUser: true }, 403, "FORBIDDEN"],
    ["canonical identity mismatch", { wrongSubject: true }, 401, "UNAUTHORIZED"],
    ["User A versus Org B and Store B", { org: "org-b", store: "store-b" }, 403, "FORBIDDEN"],
    ["User A versus Store B", { store: "store-b" }, 403, "FORBIDDEN"],
    ["nonexistent organization", { org: "absent-org" }, 403, "FORBIDDEN"],
    ["nonexistent store", { store: "absent-store" }, 403, "FORBIDDEN"],
    ["forged organization", { org: "org-b", query: "?user_id=user-b&role=owner&tenant_id=org-b" }, 403, "FORBIDDEN"],
    ["forged store/provider identity", { store: "store-b", query: "?provider_store_id=store-b&store_id=store-a" }, 403, "FORBIDDEN"],
    ["invalid mode", { mode: "production" }, 400, "VALIDATION_ERROR"],
    ["malformed mode", { mode: '["live"]' }, 400, "VALIDATION_ERROR"],
    ["missing mode", { mode: null }, 400, "VALIDATION_ERROR"],
    ["empty mode", { mode: "" }, 400, "VALIDATION_ERROR"],
    ["Demo with Live organization", { mode: "demo" }, 403, "FORBIDDEN"],
    ["Demo with Live store", { mode: "demo", orgMode: "demo" }, 403, "FORBIDDEN"],
    ["Live with Demo store", { status: "demo" }, 403, "FORBIDDEN"],
    ["foreign tenant and mode manipulation", { org: "org-b", store: "store-b", mode: "demo", orgMode: "demo", status: "demo" }, 403, "FORBIDDEN"],
    ["invalid persisted role", { role: "superadmin" }, 403, "FORBIDDEN"],
    ["prototype role", { role: "constructor" }, 403, "FORBIDDEN"],
    ["malformed persisted role", { role: ["owner"] }, 403, "FORBIDDEN"],
    ["missing persisted role", { role: null }, 403, "FORBIDDEN"],
    ["inconsistent returned store ID", { wrongStore: true }, 403, "FORBIDDEN"],
    ["unexpected dependency error is sanitized", { failure: true }, 503, "INTERNAL_ERROR"],
  ];
  it.each(denied)("%s", async (_name, options, status, code) => {
    const result = await exercise(options);
    expect(result.response.status).toBe(status);
    expect(JSON.parse(result.body)).toEqual({ error: code, requestId: "task3-test" });
    expect(result.listProducts).not.toHaveBeenCalled();
  });
  it.each(Object.keys(ROLE_PERMISSIONS))("allows canonical role %s only in verified scope", async role => {
    const result = await exercise({ role, query: "?user_id=user-b&organization_id=org-b&store_id=store-b&role=owner&mode=demo&auth=override" });
    expect(result.response.status).toBe(200);
    expect(result.findUserBySubject).toHaveBeenCalledWith("subject-a");
    expect(result.listProducts).toHaveBeenCalledOnce(); expect(result.listProducts).toHaveBeenCalledWith({ organizationId: "org-a", storeId: "store-a", mode: "live" }, "salla");
    expect(result.fetcher).toHaveBeenCalledWith("https://auth.invalid/auth/v1/user", expect.anything());
  });
  it("allows isolated Demo scope", async () => {
    const result = await exercise({ mode: "demo", orgMode: "demo", status: "demo" });
    expect(result.response.status).toBe(200);
    expect(result.listProducts).toHaveBeenCalledOnce(); expect(result.listProducts).toHaveBeenCalledWith({ organizationId: "org-a", storeId: "store-a", mode: "demo" }, "salla");
  });
  it("does not expose a commerce mutation endpoint", async () => {
    const result = await exercise({ method: "POST" });
    expect(result.response.status).toBe(404);
    expect(result.listProducts).not.toHaveBeenCalled();
  });
});

describe("Task 3 canonical runtime parsers", () => {
  it.each([undefined, null, 0, {}, [], ["live"], "", "LIVE", " live", "live,demo", "constructor"])("rejects malformed mode %j", value => {
    expect(() => parseMode(value)).toThrow();
  });
  it.each([undefined, null, 0, {}, [], ["owner"], "", "OWNER", " owner", "__proto__", "toString"])("rejects malformed role %j", value => {
    expect(() => parseRole(value)).toThrow();
  });
  it("preserves all valid modes and roles", () => {
    for (const mode of ["live", "demo"]) expect(parseMode(mode)).toBe(mode);
    for (const role of Object.keys(ROLE_PERMISSIONS)) expect(parseRole(role)).toBe(role);
  });
});
