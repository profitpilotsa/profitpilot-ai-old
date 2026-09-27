import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { organizations, platformConnections, providerCredentials, stores, syncJobs, webhookEvents } from "../db/schema";
import type { EncryptedCredential } from "./credentialVault";

/**
 * Server-only persistence for a pre-bound Live Salla connection.  It never
 * accepts a caller-supplied organization/store pair: those values are derived
 * from the provider's already-bound external store identity.
 */
export class PreboundLiveSallaConnection {
  private readonly verifiedByRepository = true;

  private constructor(
    readonly id: string,
    readonly organizationId: string,
    readonly storeId: string,
    readonly externalStoreId: string,
    readonly status: string,
    readonly authorizationState: string,
    readonly externalAccountId: string | undefined,
    readonly grantedScopes: readonly string[],
    readonly tokenExpiresAt: Date | undefined,
  ) {}

  static fromDatabaseRow(row: {
    connectionId: string;
    organizationId: string;
    storeId: string;
    externalStoreId: string | null;
    connectionStatus: string;
    authorizationState: string;
    externalAccountId: string | null;
    grantedScopes: string[];
    tokenExpiresAt: Date | null;
  }): PreboundLiveSallaConnection {
    if (!row.externalStoreId || row.connectionStatus === "demo") {
      throw new IntegrationRepositoryError("CONNECTION_NOT_PREBOUND", "The provider connection is not a pre-bound live Salla connection");
    }

    return new PreboundLiveSallaConnection(
      row.connectionId,
      row.organizationId,
      row.storeId,
      row.externalStoreId,
      row.connectionStatus,
      row.authorizationState,
      row.externalAccountId ?? undefined,
      [...row.grantedScopes],
      row.tokenExpiresAt ?? undefined,
    );
  }

  isRepositoryVerified(): boolean {
    return this.verifiedByRepository;
  }
}

export type IntegrationRepositoryErrorCode =
  | "CONNECTION_NOT_PREBOUND"
  | "CONNECTION_AMBIGUOUS"
  | "CONNECTION_SCOPE_INVALID"
  | "WEBHOOK_EVENT_SCOPE_INVALID"
  | "CREDENTIAL_ENVELOPE_INVALID"
  | "PERSISTENCE_FAILED"
  | "VALIDATION_ERROR";

/** Deliberately generic: these errors must never include credential material. */
export class IntegrationRepositoryError extends Error {
  constructor(readonly code: IntegrationRepositoryErrorCode, message: string) {
    super(message);
    this.name = "IntegrationRepositoryError";
  }
}

export interface VerifiedWebhookReservationInput {
  externalEventId: string;
  eventType?: string;
  payloadHash?: string;
  receivedAt?: Date;
}

export type VerifiedWebhookReservation =
  | { result: "reserved"; webhookEventId: string }
  | { result: "duplicate" };

export interface ScopedSyncJobInput {
  idempotencyKey: string;
  resource: string;
  webhookEventId?: string;
  runAfter?: Date;
}

export type ScopedSyncJobEnqueueResult =
  | { result: "enqueued"; jobId: string }
  | { result: "duplicate" };

export interface EncryptedProviderCredentialEnvelopes {
  accessToken: EncryptedCredential;
  refreshToken?: EncryptedCredential;
  tokenExpiresAt?: Date;
}

export interface StoredEncryptedProviderCredentials extends EncryptedProviderCredentialEnvelopes {
  id: string;
}

export interface ConnectedSallaAuthorization {
  credentialReference: string;
  externalAccountId?: string;
  grantedScopes: readonly string[];
  tokenExpiresAt?: Date;
}

export interface ClaimedSallaSyncJob { id: string; connectionId: string; organizationId: string; storeId: string; resource: string; attempt: number; }

/**
 * A repository boundary for custody and durable queue facts.  It stores only
 * authenticated credential envelopes; decrypting a token belongs to an
 * explicit server worker and is intentionally not implemented here.
 */
export class PostgresIntegrationRepository {
  constructor(private readonly db: Database) {}

  /**
   * Resolves the Salla merchant identity to exactly one pre-provisioned Live
   * ProfitPilot store/connection.  No organization or store value comes from
   * the webhook caller.
   */
  async findPreboundLiveSallaConnection(externalStoreId: string): Promise<PreboundLiveSallaConnection | undefined> {
    const externalId = requiredText(externalStoreId, "external store ID");
    const rows = await this.db
      .select({
        connectionId: platformConnections.id,
        organizationId: platformConnections.organizationId,
        storeId: platformConnections.storeId,
        externalStoreId: stores.externalStoreId,
        connectionStatus: platformConnections.status,
        authorizationState: platformConnections.authorizationState,
        externalAccountId: platformConnections.externalAccountId,
        grantedScopes: platformConnections.grantedScopes,
        tokenExpiresAt: platformConnections.tokenExpiresAt,
      })
      .from(platformConnections)
      .innerJoin(
        stores,
        and(
          eq(stores.id, platformConnections.storeId),
          eq(stores.organizationId, platformConnections.organizationId),
        ),
      )
      .innerJoin(organizations, eq(organizations.id, platformConnections.organizationId))
      .where(
        and(
          eq(stores.externalStoreId, externalId),
          eq(stores.platform, "salla"),
          eq(organizations.mode, "live"),
          eq(platformConnections.provider, "salla"),
        ),
      )
      .limit(2);

    const liveRows = rows.filter((row) => row.connectionStatus !== "demo");
    if (liveRows.length === 0) return undefined;
    if (liveRows.length > 1) {
      throw new IntegrationRepositoryError("CONNECTION_AMBIGUOUS", "The provider store identity maps to more than one live connection");
    }

    return PreboundLiveSallaConnection.fromDatabaseRow(liveRows[0]);
  }

  async findPreboundLiveSallaConnectionById(connectionId: string, organizationId: string, storeId: string): Promise<PreboundLiveSallaConnection | undefined> {
    const rows = await this.db
      .select({ connectionId: platformConnections.id, organizationId: platformConnections.organizationId, storeId: platformConnections.storeId, externalStoreId: stores.externalStoreId, connectionStatus: platformConnections.status, authorizationState: platformConnections.authorizationState, externalAccountId: platformConnections.externalAccountId, grantedScopes: platformConnections.grantedScopes, tokenExpiresAt: platformConnections.tokenExpiresAt })
      .from(platformConnections)
      .innerJoin(stores, and(eq(stores.id, platformConnections.storeId), eq(stores.organizationId, platformConnections.organizationId)))
      .innerJoin(organizations, eq(organizations.id, platformConnections.organizationId))
      .where(and(eq(platformConnections.id, connectionId), eq(platformConnections.organizationId, organizationId), eq(platformConnections.storeId, storeId), eq(platformConnections.provider, "salla"), eq(stores.platform, "salla"), eq(organizations.mode, "live")))
      .limit(2);
    if (rows.length === 0) return undefined;
    if (rows.length > 1) throw new IntegrationRepositoryError("CONNECTION_AMBIGUOUS", "More than one scoped Salla connection was found");
    return PreboundLiveSallaConnection.fromDatabaseRow(rows[0]);
  }

  /** Atomically leases one due job. SKIP LOCKED prevents concurrent workers from duplicating provider reads. */
  async claimNextSallaJob(now = new Date(), leaseMs = 5 * 60_000): Promise<ClaimedSallaSyncJob | undefined> {
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);
    const rows = await this.db.execute(sql`
      WITH candidate AS (
        SELECT id FROM sync_jobs
        WHERE provider = 'salla' AND (status = 'queued' AND run_after <= ${now} OR status = 'running' AND lease_expires_at <= ${now})
        ORDER BY run_after, id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE sync_jobs job
      SET status = 'running', attempt = job.attempt + 1, lease_expires_at = ${leaseExpiresAt}, updated_at = ${now}
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING job.id, job.connection_id, job.organization_id, job.store_id, job.resource, job.attempt
    `);
    const row = rows[0] as { id: string; connection_id: string; organization_id: string; store_id: string; resource: string; attempt: number } | undefined;
    return row ? { id: row.id, connectionId: row.connection_id, organizationId: row.organization_id, storeId: row.store_id, resource: row.resource, attempt: row.attempt } : undefined;
  }

  async completeSallaJob(job: ClaimedSallaSyncJob, now = new Date()): Promise<void> {
    const [updated] = await this.db.update(syncJobs).set({ status: "succeeded", completedAt: now, leaseExpiresAt: null, updatedAt: now, lastError: null }).where(and(eq(syncJobs.id, job.id), eq(syncJobs.organizationId, job.organizationId), eq(syncJobs.storeId, job.storeId), eq(syncJobs.connectionId, job.connectionId), eq(syncJobs.status, "running"))).returning({ id: syncJobs.id });
    if (!updated) throw new IntegrationRepositoryError("CONNECTION_SCOPE_INVALID", "The leased Salla job is outside its original scope");
  }

  async markSallaConnectionSynced(connection: PreboundLiveSallaConnection, now = new Date()): Promise<void> {
    assertPreboundConnection(connection);
    const [updated] = await this.db.update(platformConnections).set({ lastSyncAt: now }).where(and(eq(platformConnections.id, connection.id), eq(platformConnections.organizationId, connection.organizationId), eq(platformConnections.storeId, connection.storeId), eq(platformConnections.provider, "salla"))).returning({ id: platformConnections.id });
    if (!updated) throw new IntegrationRepositoryError("CONNECTION_SCOPE_INVALID", "The resolved Salla connection is outside its original scope");
  }

  async retryOrFailSallaJob(job: ClaimedSallaSyncJob, now = new Date(), maxAttempts = 3): Promise<void> {
    const retry = job.attempt < maxAttempts;
    const [updated] = await this.db.update(syncJobs).set({ status: retry ? "queued" : "failed", runAfter: new Date(now.getTime() + Math.min(60_000 * 2 ** Math.max(0, job.attempt - 1), 15 * 60_000)), leaseExpiresAt: null, updatedAt: now, lastError: "Salla read operation failed" }).where(and(eq(syncJobs.id, job.id), eq(syncJobs.organizationId, job.organizationId), eq(syncJobs.storeId, job.storeId), eq(syncJobs.connectionId, job.connectionId), eq(syncJobs.status, "running"))).returning({ id: syncJobs.id });
    if (!updated) throw new IntegrationRepositoryError("CONNECTION_SCOPE_INVALID", "The leased Salla job is outside its original scope");
  }

  /** A unique scoped insert makes verified provider-event replay atomic. */
  async reserveVerifiedWebhookEvent(
    connection: PreboundLiveSallaConnection,
    input: VerifiedWebhookReservationInput,
  ): Promise<VerifiedWebhookReservation> {
    assertPreboundConnection(connection);
    const externalEventId = requiredText(input.externalEventId, "external event ID");
    const [created] = await this.db
      .insert(webhookEvents)
      .values({
        id: randomUUID(),
        organizationId: connection.organizationId,
        storeId: connection.storeId,
        connectionId: connection.id,
        mode: "live",
        provider: "salla",
        eventType: optionalText(input.eventType),
        externalEventId,
        payloadHash: optionalText(input.payloadHash),
        status: "verified",
        attempt: 0,
        receivedAt: input.receivedAt ?? new Date(),
      })
      .onConflictDoNothing({
        target: [
          webhookEvents.organizationId,
          webhookEvents.storeId,
          webhookEvents.provider,
          webhookEvents.externalEventId,
        ],
      })
      .returning({ id: webhookEvents.id });

    return created ? { result: "reserved", webhookEventId: created.id } : { result: "duplicate" };
  }

  /** A unique scoped insert makes job idempotency atomic within one store. */
  async enqueueScopedJob(
    connection: PreboundLiveSallaConnection,
    input: ScopedSyncJobInput,
  ): Promise<ScopedSyncJobEnqueueResult> {
    assertPreboundConnection(connection);
    const idempotencyKey = requiredText(input.idempotencyKey, "job idempotency key");
    const resource = requiredText(input.resource, "job resource");

    if (input.webhookEventId) {
      await this.assertWebhookEventBelongsToConnection(connection, input.webhookEventId);
    }

    const [created] = await this.db
      .insert(syncJobs)
      .values({
        id: randomUUID(),
        organizationId: connection.organizationId,
        storeId: connection.storeId,
        connectionId: connection.id,
        webhookEventId: input.webhookEventId ?? null,
        mode: "live",
        provider: "salla",
        resource,
        idempotencyKey,
        status: "queued",
        attempt: 0,
        runAfter: input.runAfter ?? new Date(),
      })
      .onConflictDoNothing({ target: [syncJobs.organizationId, syncJobs.storeId, syncJobs.idempotencyKey] })
      .returning({ id: syncJobs.id });

    return created ? { result: "enqueued", jobId: created.id } : { result: "duplicate" };
  }

  /** Stores only authenticated ciphertext envelopes, never raw provider tokens. */
  async saveEncryptedCredentialEnvelopes(
    connection: PreboundLiveSallaConnection,
    credentials: EncryptedProviderCredentialEnvelopes,
    now = new Date(),
  ): Promise<{ id: string }> {
    assertPreboundConnection(connection);
    const accessTokenCiphertext = serializeEnvelope(credentials.accessToken);
    const refreshTokenCiphertext = credentials.refreshToken ? serializeEnvelope(credentials.refreshToken) : null;

    const [stored] = await this.db
      .insert(providerCredentials)
      .values({
        id: randomUUID(),
        organizationId: connection.organizationId,
        storeId: connection.storeId,
        connectionId: connection.id,
        provider: "salla",
        accessTokenCiphertext,
        refreshTokenCiphertext,
        tokenExpiresAt: credentials.tokenExpiresAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          providerCredentials.organizationId,
          providerCredentials.storeId,
          providerCredentials.connectionId,
          providerCredentials.provider,
        ],
        set: {
          accessTokenCiphertext,
          refreshTokenCiphertext,
          tokenExpiresAt: credentials.tokenExpiresAt ?? null,
          updatedAt: now,
        },
      })
      .returning({ id: providerCredentials.id });

    if (!stored) throw new IntegrationRepositoryError("PERSISTENCE_FAILED", "Encrypted provider credentials could not be stored");
    return stored;
  }

  /** Reads envelopes only.  This repository intentionally has no decryption method. */
  async readEncryptedCredentialEnvelopes(
    connection: PreboundLiveSallaConnection,
  ): Promise<StoredEncryptedProviderCredentials | undefined> {
    assertPreboundConnection(connection);
    const rows = await this.db
      .select({
        id: providerCredentials.id,
        accessTokenCiphertext: providerCredentials.accessTokenCiphertext,
        refreshTokenCiphertext: providerCredentials.refreshTokenCiphertext,
        tokenExpiresAt: providerCredentials.tokenExpiresAt,
      })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.organizationId, connection.organizationId),
          eq(providerCredentials.storeId, connection.storeId),
          eq(providerCredentials.connectionId, connection.id),
          eq(providerCredentials.provider, "salla"),
        ),
      )
      .limit(2);

    if (rows.length === 0) return undefined;
    if (rows.length > 1) {
      throw new IntegrationRepositoryError("CONNECTION_AMBIGUOUS", "More than one encrypted credential record exists for this connection");
    }

    const row = rows[0];
    return {
      id: row.id,
      accessToken: deserializeEnvelope(row.accessTokenCiphertext),
      refreshToken: row.refreshTokenCiphertext ? deserializeEnvelope(row.refreshTokenCiphertext) : undefined,
      tokenExpiresAt: row.tokenExpiresAt ?? undefined,
    };
  }

  /** Updates only the exact pre-bound connection resolved from the provider identity. */
  async markConnectionConnected(
    connection: PreboundLiveSallaConnection,
    authorization: ConnectedSallaAuthorization,
  ): Promise<void> {
    assertPreboundConnection(connection);
    const credentialReference = requiredText(authorization.credentialReference, "credential reference");
    const [updated] = await this.db
      .update(platformConnections)
      .set({
        status: "connected",
        authorizationState: "authorized",
        credentialReference,
        externalAccountId: optionalText(authorization.externalAccountId),
        grantedScopes: [...authorization.grantedScopes],
        tokenExpiresAt: authorization.tokenExpiresAt ?? null,
      })
      .where(
        and(
          eq(platformConnections.id, connection.id),
          eq(platformConnections.organizationId, connection.organizationId),
          eq(platformConnections.storeId, connection.storeId),
          eq(platformConnections.provider, "salla"),
        ),
      )
      .returning({ id: platformConnections.id });

    if (!updated) {
      throw new IntegrationRepositoryError("CONNECTION_SCOPE_INVALID", "The resolved connection is no longer available in its original scope");
    }
  }

  private async assertWebhookEventBelongsToConnection(
    connection: PreboundLiveSallaConnection,
    webhookEventId: string,
  ): Promise<void> {
    const [event] = await this.db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.id, webhookEventId),
          eq(webhookEvents.organizationId, connection.organizationId),
          eq(webhookEvents.storeId, connection.storeId),
          eq(webhookEvents.connectionId, connection.id),
          eq(webhookEvents.provider, "salla"),
        ),
      )
      .limit(1);

    if (!event) {
      throw new IntegrationRepositoryError("WEBHOOK_EVENT_SCOPE_INVALID", "The webhook event is outside the resolved connection scope");
    }
  }
}

function assertPreboundConnection(connection: PreboundLiveSallaConnection): void {
  if (!(connection instanceof PreboundLiveSallaConnection) || !connection.isRepositoryVerified()) {
    throw new IntegrationRepositoryError("CONNECTION_SCOPE_INVALID", "A repository-verified live Salla connection is required");
  }
}

function requiredText(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new IntegrationRepositoryError("VALIDATION_ERROR", `A ${field} is required`);
  }
  return value;
}

function optionalText(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value : null;
}

function serializeEnvelope(envelope: EncryptedCredential): string {
  if (!isEncryptedCredential(envelope)) {
    throw new IntegrationRepositoryError("CREDENTIAL_ENVELOPE_INVALID", "An authenticated credential envelope is required");
  }
  return JSON.stringify(envelope);
}

function deserializeEnvelope(value: string): EncryptedCredential {
  try {
    const envelope: unknown = JSON.parse(value);
    if (isEncryptedCredential(envelope)) return envelope;
  } catch {
    // Deliberately discard parser details: encrypted material must not reach logs.
  }
  throw new IntegrationRepositoryError("CREDENTIAL_ENVELOPE_INVALID", "Stored provider credential ciphertext is invalid");
}

function isEncryptedCredential(value: unknown): value is EncryptedCredential {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<EncryptedCredential>;
  return envelope.version === 1
    && typeof envelope.iv === "string" && envelope.iv.length > 0
    && typeof envelope.ciphertext === "string" && envelope.ciphertext.length > 0
    && typeof envelope.tag === "string" && envelope.tag.length > 0;
}
