import { describe, expect, it } from "vitest";
import { SallaSyncWorker } from "../server/application/sallaSyncWorker";

describe("Salla sync worker", () => {
  it("does nothing when no durable job is due", async () => {
    const repository = { claimNextSallaJob: async () => undefined };
    const worker = new SallaSyncWorker(repository as never, {} as never, Buffer.alloc(32).toString("base64"));
    await expect(worker.runOne()).resolves.toBe("idle");
  });
  it("returns a generic retry path without exposing provider or credential details", async () => {
    const job = { id: "job", connectionId: "connection", organizationId: "organization", storeId: "store", resource: "initial", attempt: 1 };
    const calls: string[] = [];
    const repository = { claimNextSallaJob: async () => job, findPreboundLiveSallaConnectionById: async () => undefined, retryOrFailSallaJob: async (received: typeof job) => { calls.push(received.id); } };
    const worker = new SallaSyncWorker(repository as never, {} as never, Buffer.alloc(32).toString("base64"));
    await expect(worker.runOne()).resolves.toBe("retried");
    expect(calls).toEqual(["job"]);
  });
});
