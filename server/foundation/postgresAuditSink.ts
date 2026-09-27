import { randomUUID } from "node:crypto";
import type { Database } from "../db/client";
import { auditEvents } from "../db/schema";
import type { AuditSink } from "./audit";

/** Append-only application audit writer; callers never provide database credentials. */
export class PostgresAuditSink implements AuditSink {
  constructor(private readonly db: Database) {}
  async record(event: Parameters<AuditSink["record"]>[0]): Promise<void> {
    await this.db.insert(auditEvents).values({ id: randomUUID(), organizationId: event.organizationId, storeId: event.storeId ?? null, actorUserId: event.actorUserId ?? null, requestId: event.requestId, action: event.action, entityType: event.entityType, entityId: event.entityId ?? null, result: event.result, metadata: event.metadata ?? null });
  }
}
