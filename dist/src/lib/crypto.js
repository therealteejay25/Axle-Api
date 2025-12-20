"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const ALGO = "aes-256-gcm";
const KEY = (env_1.env.INTEGRATION_ENC_KEY || "").padEnd(32, "0").slice(0, 32);
const encrypt = (plaintext) => {
    if (!plaintext)
        return plaintext;
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGO, Buffer.from(KEY), iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
};
exports.encrypt = encrypt;
const decrypt = (payload) => {
    if (!payload)
        return payload;
    try {
        const [ivB64, dataB64, tagB64] = payload.split(":");
        if (!ivB64 || !dataB64 || !tagB64)
            return payload;
        const iv = Buffer.from(ivB64, "base64");
        const encrypted = Buffer.from(dataB64, "base64");
        const tag = Buffer.from(tagB64, "base64");
        const decipher = crypto_1.default.createDecipheriv(ALGO, Buffer.from(KEY), iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ]);
        return decrypted.toString("utf8");
    }
    catch (err) {
        // If decryption fails, return raw payload for backwards compatibility
        return payload;
    }
};
exports.decrypt = decrypt;
exports.default = { encrypt: exports.encrypt, decrypt: exports.decrypt };
