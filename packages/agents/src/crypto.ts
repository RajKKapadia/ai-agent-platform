import { appConfig } from "@repo/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const algorithm = "aes-256-gcm";
const ivLength = 12;

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function getEncryptionKey(): Buffer {
  const secret = appConfig.secrets.agentEncryptionKey;

  if (!secret) {
    throw new Error(
      "Missing required environment variable: AGENT_SECRET_ENCRYPTION_KEY",
    );
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string): EncryptedSecret {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: authTag.toString("base64url"),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(secret.iv, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(secret.authTag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}
