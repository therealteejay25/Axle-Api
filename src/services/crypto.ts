import crypto from "crypto";
import { env } from "../config/env";

// ============================================
// CRYPTO SERVICE
// ============================================
// Handles encryption/decryption of sensitive data
// like OAuth tokens stored in integrations.
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Get encryption key from env (must be 32 bytes for AES-256)
const getKey = (): Buffer => {
  const key = env.INTEGRATION_ENC_KEY;
  if (!key) {
    throw new Error("INTEGRATION_ENC_KEY not set");
  }
  // Hash the key to ensure it's exactly 32 bytes
  return crypto.createHash("sha256").update(key).digest();
};

/**
 * Encrypt a token for storage
 */
export const encryptToken = (plaintext: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const tag = cipher.getAuthTag();
  
  // Format: iv:tag:encrypted
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
};

/**
 * Decrypt a stored token
 */
export const decryptToken = (ciphertext: string): string => {
  const key = getKey();
  const parts = ciphertext.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }
  
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
};

/**
 * Generate a secure random token (for webhooks, etc)
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * Hash a value (for webhook signatures, etc)
 */
export const hashValue = (value: string, algorithm: string = "sha256"): string => {
  return crypto.createHash(algorithm).update(value).digest("hex");
};

/**
 * Verify HMAC signature (for webhook verification)
 */
export const verifyHmac = (
  payload: string,
  signature: string,
  secret: string,
  algorithm: string = "sha256"
): boolean => {
  const expectedSignature = crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

export default {
  encryptToken,
  decryptToken,
  generateSecureToken,
  hashValue,
  verifyHmac
};
