/** Phase 1: UI-independent tenant, authorization, data, and integration contracts. */
export type Id=string; export type Mode="demo"|"live"; export type Role="owner"|"admin"|"manager"|"marketing"|"finance"|"inventory"|"viewer"; export type Platform="salla"|"zid"|"shopify"|"other";
export type ErrorCode="NO_DATA"|"NOT_CONFIGURED"|"NOT_CONNECTED"|"INCOMPLETE_DATA"|"SERVICE_UNAVAILABLE"|"UNAUTHORIZED"|"FORBIDDEN"|"CONFLICT"|"INTERNAL_ERROR";
export class ApiError extends Error { constructor(public readonly code:ErrorCode,message:string,public readonly retryable=false){super(message);} }
export interface User { id:Id; externalSubject:string; email?:string; }
export interface Organization { id:Id; name:string; defaultCurrency:string; mode:Mode; }
export interface Membership { organizationId:Id; userId:Id; role:Role; }
export interface Store { id:Id; organizationId:Id; name:string; platform:Platform; status:"active"|"disconnected"|"error"|"demo"; }
export interface PlatformConnection { id:Id; organizationId:Id; storeId?:Id; provider:Platform; status:"not_connected"|"requires_setup"|"connected"|"demo"|"error"; credentialReference?:string; lastSyncAt?:string; }
export interface Scope { organizationId:Id; storeId?:Id; mode:Mode; }
export interface RequestContext { actor?:User; membership?:Membership; scope?:Scope; requestId:string; }
const grants:Record<Role,readonly string[]>={owner:["*"],admin:["*"],manager:["read","manage"],marketing:["read","marketing"],finance:["read","finance"],inventory:["read","inventory"],viewer:["read"]};
export function authorize(ctx:RequestContext,permission:string):void { if(!ctx.actor||!ctx.membership||!ctx.scope) throw new ApiError("UNAUTHORIZED","Authentication and organization scope are required"); if(ctx.membership.organizationId!==ctx.scope.organizationId) throw new ApiError("FORBIDDEN","Organization scope does not match membership"); const allowed=grants[ctx.membership.role]; if(!allowed.includes("*")&&!allowed.includes(permission)&&!allowed.includes("manage")) throw new ApiError("FORBIDDEN","This organization role cannot perform that action"); }
/** Implement with demo fixtures, Drizzle, or adapters; UI never calls a database directly. */
export interface TenantRepository { findMembership(userId:Id,organizationId:Id):Promise<Membership|undefined>; findOrganization(scope:Scope):Promise<Organization|undefined>; listStores(scope:Scope):Promise<Store[]>; listConnections(scope:Scope):Promise<PlatformConnection[]>; }
export interface SyncJob { id:Id; organizationId:Id; connectionId:Id; idempotencyKey:string; status:"queued"|"running"|"succeeded"|"failed"; attempt:number; }
export interface WebhookEvent { id:Id; organizationId?:Id; provider:Platform; externalEventId:string; status:"received"|"verified"|"processed"|"failed"; }
export interface AuditEvent { id:Id; organizationId:Id; actorUserId?:Id; action:string; entityType:string; entityId?:Id; result:"success"|"failure"|"pending"; }
export interface PlatformAdapter { readonly platform:Platform; describeConnection(connection:PlatformConnection):Promise<PlatformConnection>; }
