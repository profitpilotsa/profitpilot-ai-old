import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { IdempotentJobQueue } from "../server/foundation/jobs";
import { processExactlyOnce, verifyHmacSignature } from "../server/integrations/webhooks";

describe("Phase 1 webhook and job protection", () => {
  it("rejects spoofed webhook signatures and preserves duplicate-event idempotency", async () => {
    const body = Buffer.from("payload"); const secret = "test-secret";
    expect(() => verifyHmacSignature(body, createHmac("sha256", secret).update(body).digest("hex"), secret)).not.toThrow();
    expect(() => verifyHmacSignature(body, "00", secret)).toThrow();
    let reserved = false; let effects = 0;
    const store = { reserve: async () => reserved ? "duplicate" as const : (reserved = true, "reserved" as const), markProcessed: async () => {}, markFailed: async () => {} };
    const receipt = { provider: "salla", organizationId: "org", storeId: "store", externalEventId: "event", payloadHash: "hash" };
    await expect(processExactlyOnce(store, receipt, async () => { effects++; })).resolves.toBe("processed");
    await expect(processExactlyOnce(store, receipt, async () => { effects++; })).resolves.toBe("duplicate");
    expect(effects).toBe(1);
  });
  it("deduplicates jobs and makes retries explicit", async () => {
    const jobs = new Map<string, any>(); const queue = new IdempotentJobQueue({ findByKey: async (org, key) => jobs.get(`${org}:${key}`), save: async job => { jobs.set(`${job.organizationId}:${job.idempotencyKey}`, job); } });
    const one = await queue.enqueue({ organizationId: "org", storeId: "store", connectionId: "connection", idempotencyKey: "sync" });
    expect((await queue.enqueue({ organizationId: "org", storeId: "store", connectionId: "connection", idempotencyKey: "sync" })).id).toBe(one.id);
    expect((await queue.retry(one)).attempt).toBe(1);
  });
});
