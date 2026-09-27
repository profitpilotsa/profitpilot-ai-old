import { randomUUID } from "node:crypto";
import type { SyncJob } from "../phase1";
export interface JobStore { findByKey(organizationId: string, key: string): Promise<SyncJob | undefined>; save(job: SyncJob): Promise<void>; }
export class IdempotentJobQueue {
  constructor(private readonly store: JobStore) {}
  async enqueue(input: Omit<SyncJob, "id" | "status" | "attempt">): Promise<SyncJob> { const existing = await this.store.findByKey(input.organizationId, input.idempotencyKey); if (existing) return existing; const job: SyncJob = { ...input, id: randomUUID(), status: "queued", attempt: 0 }; await this.store.save(job); return job; }
  async retry(job: SyncJob): Promise<SyncJob> { const next: SyncJob = { ...job, status: "queued", attempt: job.attempt + 1 }; await this.store.save(next); return next; }
}
