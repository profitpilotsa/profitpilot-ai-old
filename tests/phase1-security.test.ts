import { describe, expect, it } from "vitest";
import { ApiError, assertLiveProviderAction, assertNoDirectFinancialMutation, authorize, type RequestContext } from "../server/phase1";
import { RequestContextResolver } from "../server/foundation/context";

const context: RequestContext = { actor: { id: "user", externalSubject: "subject" }, membership: { userId: "user", organizationId: "org", role: "owner" }, scope: { organizationId: "org", storeId: "store", mode: "live" }, requestId: "request" };
describe("Phase 1 server security", () => {
  it("uses action-level permissions and never grants direct financial mutation", () => {
    expect(() => authorize(context, "commerce.read")).not.toThrow();
    expect(() => assertNoDirectFinancialMutation()).toThrow(ApiError);
  });
  it("rejects provider execution from Demo before adapter selection", () => {
    expect(() => assertLiveProviderAction({ ...context, scope: { ...context.scope, mode: "demo" } })).toThrow(ApiError);
  });
  it("rejects a valid identity attempting another organization or a live/demo store escape", async () => {
    const resolver = new RequestContextResolver({ verifyBearer: async () => ({ subject: "subject" }) }, {
      findMembership: async () => ({ userId: "user", organizationId: "org", role: "viewer" }),
      findOrganization: async () => ({ id: "org", name: "Org", defaultCurrency: "SAR", mode: "live" }),
      findStore: async () => ({ id: "store", organizationId: "org", name: "Store", platform: "salla", status: "active" }),
    });
    await expect(resolver.resolve({ bearerToken: "token", user: context.actor, organizationId: "other", storeId: "store", mode: "live", requestId: "r" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resolver.resolve({ bearerToken: "token", user: context.actor, organizationId: "org", storeId: "store", mode: "demo", requestId: "r" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("fails closed when a repository returns a membership or store from another organization", async () => {
    const resolver = new RequestContextResolver({ verifyBearer: async () => ({ subject: "subject" }) }, {
      findMembership: async () => ({ userId: "user", organizationId: "other-org", role: "owner" }),
      findOrganization: async () => ({ id: "org", name: "Org", defaultCurrency: "SAR", mode: "live" }),
      findStore: async () => ({ id: "store", organizationId: "other-org", name: "Store", platform: "salla", status: "active" }),
    });
    await expect(resolver.resolve({ bearerToken: "token", user: context.actor, organizationId: "org", storeId: "store", mode: "live", requestId: "r" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
