import { describe, expect, it } from "vitest";
import { CredentialVault, CredentialVaultError } from "../server/foundation/credentialVault";

const key = Buffer.alloc(32, 7).toString("base64");

describe("Phase 1 credential vault", () => {
  it("encrypts and authenticates an access or refresh token without returning plaintext", () => {
    const vault = CredentialVault.fromEnvironment({ CREDENTIAL_ENCRYPTION_KEY: key });
    const accessEnvelope = vault.encrypt("access-token-example");
    const refreshEnvelope = vault.encrypt("refresh-token-example");

    expect(accessEnvelope).toMatchObject({ version: 1 });
    expect(JSON.stringify(accessEnvelope)).not.toContain("access-token-example");
    expect(vault.decrypt(accessEnvelope)).toBe("access-token-example");
    expect(vault.decrypt(refreshEnvelope)).toBe("refresh-token-example");
  });

  it("uses a fresh IV for each encrypted credential", () => {
    const vault = new CredentialVault({ encryptionKeyBase64: key });
    const first = vault.encrypt("same-token");
    const second = vault.encrypt("same-token");

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("rejects missing, malformed, and wrong-length encryption keys", () => {
    expect(() => new CredentialVault()).toThrow(CredentialVaultError);
    expect(() => new CredentialVault({})).toThrow(CredentialVaultError);
    expect(() => new CredentialVault({ encryptionKeyBase64: "not base64" })).toThrow(CredentialVaultError);
    expect(() => new CredentialVault({ encryptionKeyBase64: Buffer.alloc(31).toString("base64") })).toThrow(CredentialVaultError);
  });

  it("rejects malformed or tampered ciphertext instead of returning unauthenticated plaintext", () => {
    const vault = new CredentialVault({ encryptionKeyBase64: key });
    const envelope = vault.encrypt("access-token-example");

    expect(() => vault.decrypt({ ...envelope, iv: "not-base64" })).toThrow(CredentialVaultError);
    expect(() => vault.decrypt({ ...envelope, tag: Buffer.alloc(16, 2).toString("base64") })).toThrow(CredentialVaultError);
    expect(() => vault.decrypt({ ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -4)}AAAA` })).toThrow(CredentialVaultError);
  });

  it("rejects empty credential values", () => {
    const vault = new CredentialVault({ encryptionKeyBase64: key });
    expect(() => vault.encrypt("")).toThrow(CredentialVaultError);
  });
});
