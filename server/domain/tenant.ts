export type Id = string;
export type Platform = "salla" | "zid" | "shopify" | "other";
export type DataMode = "demo" | "live";
export type Provenance = "automatic" | "demo" | "manual" | "platform" | "imported" | "calculated" | "estimated";
export type OrganizationRole = "owner" | "admin" | "manager" | "marketing" | "finance" | "inventory" | "viewer";
export interface User { id: Id; externalSubject: string; email?: string; displayName?: string; }
export interface Organization { id: Id; name: string; defaultCurrency: string; mode: DataMode; }
export interface OrganizationMembership { organizationId: Id; userId: Id; role: OrganizationRole; }
export interface Store { id: Id; organizationId: Id; name: string; platform: Platform; externalStoreId?: string; currency: string; status: "active" | "disconnected" | "error" | "demo"; }
export interface PlatformConnection { id: Id; organizationId: Id; storeId?: Id; provider: Platform; status: "not_connected" | "requires_setup" | "connected" | "demo" | "error"; credentialReference?: string; lastSyncAt?: string; }
export interface DataScope { organizationId: Id; storeId?: Id; mode: DataMode; }
export interface SyncJob { id: Id; organizationId: Id; connectionId: Id; status: "queued" | "running" | "succeeded" | "failed"; idempotencyKey: string; attempt: number; }
export interface WebhookEvent { id: Id; organizationId?: Id; provider: Platform; externalEventId: string; status: "received" | "verified" | "processed" | "failed"; }
export interface AuditEvent { id: Id; organizationId: Id; actorUserId?: Id; action: string; entityType: string; entityId?: Id; result: "success" | "failure" | "pending"; }
