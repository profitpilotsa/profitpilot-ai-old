import { createHash } from "node:crypto";
import { CredentialVault, CredentialVaultError } from "../foundation/credentialVault";
import { IntegrationRepositoryError, PostgresIntegrationRepository } from "../foundation/postgresIntegrationRepository";
import { ApiError } from "../phase1";
import { verifyHmacSignature } from "../integrations/webhooks";

export interface SallaWebhookConfiguration {
  webhookSecret?: string;
  securityStrategy?: string;
  credentialEncryptionKey?: string;
}

export interface SallaWebhookReceipt {
  accepted: true;
  duplicate: boolean;
}

type SallaWebhookPayload = {
  event?: unknown;
  merchant?: unknown;
  created_at?: unknown;
  data?: unknown;
};

/**
 * Verifies and durably queues Salla events. It performs no provider reads or
 * business calculation inline, so the acknowledgement path remains bounded.
 */
export class SallaWebhookReceiver {
  constructor(
    private readonly repository: PostgresIntegrationRepository,
    private readonly config: SallaWebhookConfiguration,
  ) {}

  async receive(rawBody: Buffer, headers: { signature?: string; securityStrategy?: string }): Promise<SallaWebhookReceipt> {
    if (this.config.securityStrategy !== "signature") {
      throw new ApiError("SERVICE_UNAVAILABLE", "Salla webhook verification is not configured", true);
    }
    if (headers.securityStrategy?.toLowerCase() !== "signature") {
      throw new ApiError("UNAUTHORIZED", "Unexpected Salla webhook security strategy");
    }
    verifyHmacSignature(rawBody, headers.signature, this.config.webhookSecret);

    const payload = parsePayload(rawBody);
    const eventType = requiredString(payload.event, "Salla webhook event");
    const merchantId = canonicalExternalId(payload.merchant, "Salla merchant");
    const connection = await this.repository.findPreboundLiveSallaConnection(merchantId);
    if (!connection) {
      throw new ApiError("SERVICE_UNAVAILABLE", "No pre-bound live Salla connection is available", true);
    }

    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const externalEventId = `${eventType}:${payloadHash}`;
    const reservation = await this.repository.reserveVerifiedWebhookEvent(connection, {
      externalEventId,
      eventType,
      payloadHash,
    });
    if (reservation.result === "duplicate") return { accepted: true, duplicate: true };

    if (eventType === "app.store.authorize") {
      const authorization = authorizePayload(payload.data);
      try {
        const vault = CredentialVault.fromEnvironment({ CREDENTIAL_ENCRYPTION_KEY: this.config.credentialEncryptionKey });
        const stored = await this.repository.saveEncryptedCredentialEnvelopes(connection, {
          accessToken: vault.encrypt(authorization.accessToken),
          refreshToken: authorization.refreshToken ? vault.encrypt(authorization.refreshToken) : undefined,
          tokenExpiresAt: authorization.tokenExpiresAt,
        });
        await this.repository.markConnectionConnected(connection, {
          credentialReference: `provider_credentials:${stored.id}`,
          externalAccountId: merchantId,
          grantedScopes: authorization.grantedScopes,
          tokenExpiresAt: authorization.tokenExpiresAt,
        });
      } catch (error) {
        if (error instanceof CredentialVaultError || error instanceof IntegrationRepositoryError) {
          throw new ApiError("SERVICE_UNAVAILABLE", "Salla authorization custody is not available", true);
        }
        throw error;
      }
    }

    await this.repository.enqueueScopedJob(connection, {
      idempotencyKey: `salla:${reservation.webhookEventId}:${eventType}`,
      resource: eventType === "app.store.authorize" ? "initial" : `event:${eventType}`,
      webhookEventId: reservation.webhookEventId,
    });
    return { accepted: true, duplicate: false };
  }
}

function parsePayload(rawBody: Buffer): SallaWebhookPayload {
  try {
    const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as SallaWebhookPayload;
  } catch {
    // Do not report request body content.
  }
  throw new ApiError("VALIDATION_ERROR", "Salla webhook payload is invalid");
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError("VALIDATION_ERROR", `${label} is required`);
  }
  return value;
}

function canonicalExternalId(value: unknown, label: string): string {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim().length === 0) {
    throw new ApiError("VALIDATION_ERROR", `${label} is required`);
  }
  return String(value);
}

function authorizePayload(value: unknown): { accessToken: string; refreshToken?: string; tokenExpiresAt?: Date; grantedScopes: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("VALIDATION_ERROR", "Salla authorization data is required");
  }
  const data = value as Record<string, unknown>;
  const accessToken = requiredString(data.access_token, "Salla access token");
  const refreshToken = typeof data.refresh_token === "string" && data.refresh_token.length > 0 ? data.refresh_token : undefined;
  return {
    accessToken,
    refreshToken,
    tokenExpiresAt: parseExpiry(data.expires),
    grantedScopes: normalizeScopes(data.scope),
  };
}

function parseExpiry(value: unknown): Date | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return new Date(value * 1000);
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric * 1000);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

function normalizeScopes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((scope): scope is string => typeof scope === "string" && scope.length > 0);
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  return [];
}
