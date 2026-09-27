import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface CredentialVaultConfig {
  /** A 32-byte AES key encoded with canonical base64. */
  encryptionKeyBase64?: string;
}

export interface CredentialVaultEnvironment {
  CREDENTIAL_ENCRYPTION_KEY?: string;
}

/** A storage-safe, authenticated envelope. It contains no plaintext credential fields. */
export interface EncryptedCredential {
  version: 1;
  iv: string;
  ciphertext: string;
  tag: string;
}

export type CredentialVaultErrorCode =
  | "CREDENTIAL_KEY_INVALID"
  | "CREDENTIAL_VALUE_INVALID"
  | "CREDENTIAL_CIPHERTEXT_INVALID"
  | "CREDENTIAL_DECRYPTION_FAILED";

/** Intentionally generic errors: callers must never log credential values or ciphertext. */
export class CredentialVaultError extends Error {
  constructor(readonly code: CredentialVaultErrorCode, message: string) {
    super(message);
    this.name = "CredentialVaultError";
  }
}

/**
 * Server-only credential encryption. The key is injected by the hosting environment;
 * this module never reads, logs, or persists provider credentials on its own.
 */
export class CredentialVault {
  private readonly key: Buffer;

  constructor(config?: CredentialVaultConfig) {
    this.key = decodeKey(config?.encryptionKeyBase64);
  }

  static fromEnvironment(environment: CredentialVaultEnvironment): CredentialVault {
    return new CredentialVault({ encryptionKeyBase64: environment.CREDENTIAL_ENCRYPTION_KEY });
  }

  encrypt(credential: string): EncryptedCredential {
    if (typeof credential !== "string" || credential.length === 0) {
      throw new CredentialVaultError("CREDENTIAL_VALUE_INVALID", "Credential value is required");
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(credential, "utf8"), cipher.final()]);

    return {
      version: 1,
      iv: iv.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt(envelope: EncryptedCredential): string {
    const { iv, ciphertext, tag } = decodeEnvelope(envelope);

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      throw new CredentialVaultError("CREDENTIAL_DECRYPTION_FAILED", "Credential ciphertext could not be authenticated");
    }
  }
}

function decodeKey(value: string | undefined): Buffer {
  const key = decodeBase64(value, "CREDENTIAL_KEY_INVALID");
  if (key.length !== KEY_BYTES) {
    throw new CredentialVaultError("CREDENTIAL_KEY_INVALID", "Credential encryption key must decode to 32 bytes");
  }
  return key;
}

function decodeEnvelope(envelope: EncryptedCredential): { iv: Buffer; ciphertext: Buffer; tag: Buffer } {
  if (!envelope || typeof envelope !== "object" || envelope.version !== 1) {
    throw new CredentialVaultError("CREDENTIAL_CIPHERTEXT_INVALID", "Credential ciphertext format is invalid");
  }

  const iv = decodeBase64(envelope.iv, "CREDENTIAL_CIPHERTEXT_INVALID");
  const ciphertext = decodeBase64(envelope.ciphertext, "CREDENTIAL_CIPHERTEXT_INVALID");
  const tag = decodeBase64(envelope.tag, "CREDENTIAL_CIPHERTEXT_INVALID");
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
    throw new CredentialVaultError("CREDENTIAL_CIPHERTEXT_INVALID", "Credential ciphertext format is invalid");
  }
  return { iv, ciphertext, tag };
}

function decodeBase64(value: unknown, code: CredentialVaultErrorCode): Buffer {
  if (typeof value !== "string" || value.length === 0 || !BASE64.test(value)) {
    throw new CredentialVaultError(code, code === "CREDENTIAL_KEY_INVALID" ? "Credential encryption key is invalid" : "Credential ciphertext format is invalid");
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 0 || decoded.toString("base64") !== value) {
    throw new CredentialVaultError(code, code === "CREDENTIAL_KEY_INVALID" ? "Credential encryption key is invalid" : "Credential ciphertext format is invalid");
  }
  return decoded;
}
