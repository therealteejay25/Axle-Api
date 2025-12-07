import crypto from "crypto";
import { env } from "../config/env";

const ALGO = "aes-256-gcm";
const KEY = (env.INTEGRATION_ENC_KEY || "").padEnd(32, "0").slice(0, 32);

export const encrypt = (plaintext: string) => {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, Buffer.from(KEY), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${encrypted.toString(
    "base64"
  )}:${tag.toString("base64")}`;
};

export const decrypt = (payload: string) => {
  if (!payload) return payload;
  try {
    const [ivB64, dataB64, tagB64] = payload.split(":");
    if (!ivB64 || !dataB64 || !tagB64) return payload;
    const iv = Buffer.from(ivB64, "base64");
    const encrypted = Buffer.from(dataB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const decipher = crypto.createDecipheriv(ALGO, Buffer.from(KEY), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    // If decryption fails, return raw payload for backwards compatibility
    return payload;
  }
};

export default { encrypt, decrypt };
