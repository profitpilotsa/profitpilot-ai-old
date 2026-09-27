import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SallaWebhookReceiver } from "../server/application/sallaWebhookReceiver";
import { PreboundLiveSallaConnection, type PostgresIntegrationRepository } from "../server/foundation/postgresIntegrationRepository";

const secret = "receiver-test-secret";
const key = Buffer.alloc(32, 9).toString("base64");
const connection = PreboundLiveSallaConnection.fromDatabaseRow({
  connectionId: "connection", organizationId: "organization", storeId: "store", externalStoreId: "123", connectionStatus: "requires_setup", authorizationState: "not_started", externalAccountId: null, grantedScopes: [], tokenExpiresAt: null,
});
const body = Buffer.from(JSON.stringify({ event: "app.store.authorize", merchant: 123, data: { access_token: "access-token", refresh_token: "refresh-token", expires: 1_900_000_000, scope: "products.read orders.read" } }));
const signature = createHmac("sha256", secret).update(body).digest("hex");

describe("Salla webhook receiver", () => {
  it("rejects an incorrect security strategy or signature before any repository access", async () => {
    let calls = 0;
    const repository = { findPreboundLiveSallaConnection: async () => { calls++; return connection; } } as unknown as PostgresIntegrationRepository;
    const receiver = new SallaWebhookReceiver(repository, { webhookSecret: secret, securityStrategy: "signature", credentialEncryptionKey: key });
    await expect(receiver.receive(body, { securityStrategy: "token", signature })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(receiver.receive(body, { securityStrategy: "signature", signature: "00" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(calls).toBe(0);
  });

  it("encrypts authorization credentials, marks the exact pre-bound connection, and queues once", async () => {
    const calls: string[] = [];
    const repository = {
      findPreboundLiveSallaConnection: async (merchant: string) => { calls.push(`lookup:${merchant}`); return connection; },
      reserveVerifiedWebhookEvent: async () => ({ result: "reserved" as const, webhookEventId: "event" }),
      saveEncryptedCredentialEnvelopes: async (_connection: unknown, credentials: { accessToken: unknown; refreshToken?: unknown }) => { calls.push("save"); expect(JSON.stringify(credentials)).not.toContain("access-token"); return { id: "credential" }; },
      markConnectionConnected: async (_connection: unknown, authorization: { credentialReference: string }) => { calls.push(authorization.credentialReference); },
      enqueueScopedJob: async (_connection: unknown, input: { resource: string; webhookEventId?: string }) => { calls.push(`${input.resource}:${input.webhookEventId}`); return { result: "enqueued" as const, jobId: "job" }; },
    } as unknown as PostgresIntegrationRepository;
    const receiver = new SallaWebhookReceiver(repository, { webhookSecret: secret, securityStrategy: "signature", credentialEncryptionKey: key });
    await expect(receiver.receive(body, { securityStrategy: "signature", signature })).resolves.toEqual({ accepted: true, duplicate: false });
    expect(calls).toEqual(["lookup:123", "save", "provider_credentials:credential", "initial:event"]);
  });

  it("acknowledges a verified replay without changing credentials or adding work", async () => {
    const repository = {
      findPreboundLiveSallaConnection: async () => connection,
      reserveVerifiedWebhookEvent: async () => ({ result: "duplicate" as const }),
    } as unknown as PostgresIntegrationRepository;
    const receiver = new SallaWebhookReceiver(repository, { webhookSecret: secret, securityStrategy: "signature", credentialEncryptionKey: key });
    await expect(receiver.receive(body, { securityStrategy: "signature", signature })).resolves.toEqual({ accepted: true, duplicate: true });
  });
});
