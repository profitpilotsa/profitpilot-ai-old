/** UI-independent Phase 1 security contracts. */
export type Id = string;
export type Mode = "demo" | "live";
export type Role = "owner" | "admin" | "manager" | "marketing" | "finance" | "inventory" | "viewer";
export type Platform = "salla" | "zid" | "shopify" | "other";
export type Permission = "workspace.read" | "commerce.read" | "integration.read" | "integration.connect" | "integration.sync" | "audit.read" | "financial_truth.read" | "financial_truth.recalculate" | "cost.configure" | "inventory.read" | "marketing.read";
export type ErrorCode = "NO_DATA" | "NOT_CONFIGURED" | "NOT_CONNECTED" | "INCOMPLETE_DATA" | "SERVICE_UNAVAILABLE" | "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "VALIDATION_ERROR" | "INTERNAL_ERROR";

export class ApiError extends Error { constructor(public readonly code: ErrorCode, message: string, public readonly retryable = false) { super(message); this.name = "ApiError"; } }
export interface User { id: Id; externalSubject: string; email?: string; }
export interface Organization { id: Id; name: string; defaultCurrency: string; mode: Mode; }
export interface Membership { organizationId: Id; userId: Id; role: Role; }
export interface Store { id: Id; organizationId: Id; name: string; platform: Platform; status: "active" | "disconnected" | "error" | "demo"; }
export interface PlatformConnection { id: Id; organizationId: Id; storeId: Id; provider: Platform; status: "not_connected" | "requires_setup" | "connected" | "demo" | "error"; credentialReference?: string; lastSyncAt?: string; }
export interface Scope { organizationId: Id; storeId: Id; mode: Mode; }
export interface RequestContext { actor: User; membership: Membership; scope: Scope; requestId: string; }

/** No role has a wildcard and no role can directly mutate Financial Truth. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  owner: ["workspace.read", "commerce.read", "integration.read", "integration.connect", "integration.sync", "audit.read", "financial_truth.read", "financial_truth.recalculate", "cost.configure", "inventory.read", "marketing.read"],
  admin: ["workspace.read", "commerce.read", "integration.read", "integration.sync", "audit.read", "financial_truth.read", "financial_truth.recalculate", "cost.configure", "inventory.read", "marketing.read"],
  manager: ["workspace.read", "commerce.read", "integration.read", "financial_truth.read", "inventory.read", "marketing.read"],
  marketing: ["workspace.read", "commerce.read", "marketing.read"],
  finance: ["workspace.read", "commerce.read", "financial_truth.read", "cost.configure"],
  inventory: ["workspace.read", "commerce.read", "inventory.read"],
  viewer: ["workspace.read", "commerce.read"],
};

export function authorize(context: RequestContext, permission: Permission): void {
  if (context.membership.userId !== context.actor.id || context.membership.organizationId !== context.scope.organizationId || !context.scope.storeId) throw new ApiError("FORBIDDEN", "The authenticated user is not authorized for this organization and store scope");
  if (!ROLE_PERMISSIONS[context.membership.role].includes(permission)) throw new ApiError("FORBIDDEN", "This organization role cannot perform that action");
}
export function assertLiveProviderAction(context: RequestContext): void { if (context.scope.mode !== "live") throw new ApiError("FORBIDDEN", "Demo contexts cannot invoke provider operations"); }
export function assertNoDirectFinancialMutation(): never { throw new ApiError("FORBIDDEN", "Authoritative financial outputs can only change through governed source, reconciliation, or recalculation workflows"); }

export interface TenantRepository { findMembership(userId: Id, organizationId: Id): Promise<Membership | undefined>; findOrganization(organizationId: Id): Promise<Organization | undefined>; findStore(organizationId: Id, storeId: Id): Promise<Store | undefined>; }
export interface SyncJob { id: Id; organizationId: Id; storeId: Id; connectionId: Id; idempotencyKey: string; status: "queued" | "running" | "succeeded" | "failed"; attempt: number; }
export interface WebhookEvent { id: Id; organizationId: Id; storeId: Id; provider: Platform; externalEventId: string; status: "received" | "verified" | "processed" | "failed"; }
export interface AuditEvent { id: Id; organizationId: Id; storeId?: Id; actorUserId?: Id; action: string; entityType: string; entityId?: Id; result: "success" | "failure" | "pending"; }
