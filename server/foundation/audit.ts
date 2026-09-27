import type { AuditEvent, RequestContext } from "../phase1";
import { redact } from "./observability";

export interface AuditSink { record(event: AuditEvent & { requestId: string; metadata?: Record<string, unknown> }): Promise<void>; }
export async function audit(sink: AuditSink, context: RequestContext, event: Omit<AuditEvent, "organizationId" | "storeId" | "actorUserId"> & { metadata?: Record<string, unknown> }): Promise<void> {
  await sink.record({ ...event, organizationId: context.scope.organizationId, storeId: context.scope.storeId, actorUserId: context.actor.id, requestId: context.requestId, metadata: redact(event.metadata) as Record<string, unknown> | undefined });
}
