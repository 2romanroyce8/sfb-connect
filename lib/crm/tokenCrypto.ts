import crypto from "crypto";

// AES-256-GCM, server-only. The key never leaves this process — it's read
// from an env var that is not exposed to the client bundle (no NEXT_PUBLIC_
// prefix), and this module is only ever imported from route handlers / lib
// files that run on the server.
function getKey(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY is not set — Google Calendar tokens cannot be stored securely.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
