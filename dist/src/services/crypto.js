"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyHmac = exports.hashValue = exports.generateSecureToken = exports.decryptToken = exports.encryptToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
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
const getKey = () => {
    const key = env_1.env.INTEGRATION_ENC_KEY;
    if (!key) {
        throw new Error("INTEGRATION_ENC_KEY not set");
    }
    // Hash the key to ensure it's exactly 32 bytes
    return crypto_1.default.createHash("sha256").update(key).digest();
};
/**
 * Encrypt a token for storage
 */
const encryptToken = (plaintext) => {
    const key = getKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();
    // Format: iv:tag:encrypted
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
};
exports.encryptToken = encryptToken;
/**
 * Decrypt a stored token
 */
const decryptToken = (ciphertext) => {
    const key = getKey();
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted token format");
    }
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
};
exports.decryptToken = decryptToken;
/**
 * Generate a secure random token (for webhooks, etc)
 */
const generateSecureToken = (length = 32) => {
    return crypto_1.default.randomBytes(length).toString("hex");
};
exports.generateSecureToken = generateSecureToken;
/**
 * Hash a value (for webhook signatures, etc)
 */
const hashValue = (value, algorithm = "sha256") => {
    return crypto_1.default.createHash(algorithm).update(value).digest("hex");
};
exports.hashValue = hashValue;
/**
 * Verify HMAC signature (for webhook verification)
 */
const verifyHmac = (payload, signature, secret, algorithm = "sha256") => {
    const expectedSignature = crypto_1.default
        .createHmac(algorithm, secret)
        .update(payload)
        .digest("hex");
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};
exports.verifyHmac = verifyHmac;
exports.default = {
    encryptToken: exports.encryptToken,
    decryptToken: exports.decryptToken,
    generateSecureToken: exports.generateSecureToken,
    hashValue: exports.hashValue,
    verifyHmac: exports.verifyHmac
};
