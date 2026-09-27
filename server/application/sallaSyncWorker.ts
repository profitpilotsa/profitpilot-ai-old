import { CredentialVault } from "../foundation/credentialVault";
import { PostgresIntegrationRepository } from "../foundation/postgresIntegrationRepository";
import { SallaReadOnlySyncService } from "./sallaReadOnlySync";
import { SallaReadOnlyAdapter } from "../integrations/salla";
import { SallaHttpReadClient } from "../integrations/sallaHttpReadClient";
import type { PostgresCommerceRepository } from "../repositories/postgresCommerce";

/** A bounded server-only worker. It has no HTTP/API surface and never logs tokens. */
export class SallaSyncWorker {
  constructor(private readonly repository: PostgresIntegrationRepository, private readonly commerceRepository: PostgresCommerceRepository, private readonly encryptionKey?: string) {}

  async runOne(now = new Date()): Promise<"idle" | "succeeded" | "retried"> {
    const job = await this.repository.claimNextSallaJob(now);
    if (!job) return "idle";
    try {
      if (job.resource !== "initial") throw new Error("Unsupported Salla job resource");
      const connection = await this.repository.findPreboundLiveSallaConnectionById(job.connectionId, job.organizationId, job.storeId);
      if (!connection || connection.status !== "connected") throw new Error("A connected pre-bound Salla connection is required");
      const credentials = await this.repository.readEncryptedCredentialEnvelopes(connection);
      if (!credentials) throw new Error("Salla credentials are not available");
      const token = CredentialVault.fromEnvironment({ CREDENTIAL_ENCRYPTION_KEY: this.encryptionKey }).decrypt(credentials.accessToken);
      const scope = { organizationId: connection.organizationId, storeId: connection.storeId, mode: "live" as const };
      const providerConnection = { id: connection.id, scope, provider: "salla" as const, status: "connected" as const, credentialReference: `provider_credentials:${credentials.id}` };
      const adapter = new SallaReadOnlyAdapter(new SallaHttpReadClient(scope, token));
      await new SallaReadOnlySyncService(adapter, this.commerceRepository).runInitialSync(providerConnection, now);
      await this.repository.markSallaConnectionSynced(connection, now);
      await this.repository.completeSallaJob(job, now);
      return "succeeded";
    } catch {
      await this.repository.retryOrFailSallaJob(job, now);
      return "retried";
    }
  }
}
