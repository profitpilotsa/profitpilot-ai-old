import { ApiError, parseMode, parseRole, type RequestContext, type TenantRepository, type User } from "../phase1";
import type { AuthVerifier } from "./auth";
export interface ContextRequest { bearerToken: string; user: User; organizationId: string; storeId: string; mode: unknown; requestId: string; }
/** Resolves all security dimensions before an application service may use a repository. */
export class RequestContextResolver {
  constructor(private readonly auth: AuthVerifier, private readonly tenants: TenantRepository) {}
  async resolve(request: ContextRequest): Promise<RequestContext> {
    const mode = parseMode(request.mode);
    const subject = await this.auth.verifyBearer(request.bearerToken);
    if (subject.subject !== request.user.externalSubject) throw new ApiError("UNAUTHORIZED", "The requested user does not match the authenticated identity");
    const [membership, organization, store] = await Promise.all([this.tenants.findMembership(request.user.id, request.organizationId), this.tenants.findOrganization(request.organizationId), this.tenants.findStore(request.organizationId, request.storeId)]);
    if (!membership || !organization || !store) throw new ApiError("FORBIDDEN", "The organization or store scope is not available to this user");
    // Do not rely only on repository predicates: context is a security boundary and
    // must reject inconsistent rows even if a future repository implementation regresses.
    if (membership.userId !== request.user.id || membership.organizationId !== request.organizationId || organization.id !== request.organizationId || store.organizationId !== request.organizationId || store.id !== request.storeId) {
      throw new ApiError("FORBIDDEN", "The resolved workspace scope is inconsistent");
    }
    parseRole(membership.role);
    if (organization.mode !== mode) throw new ApiError("FORBIDDEN", "The requested environment does not match the organization environment");
    if (mode === "demo" && store.status !== "demo") throw new ApiError("FORBIDDEN", "Demo requests require an isolated demo store");
    if (mode === "live" && store.status === "demo") throw new ApiError("FORBIDDEN", "Live requests cannot use a demo store");
    return { actor: request.user, membership, scope: { organizationId: organization.id, storeId: store.id, mode }, requestId: request.requestId };
  }
}
