import crypto from "crypto";

/** Opaque random token; the DATABASE only ever stores its SHA-256. */
export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}_${crypto.randomBytes(bytes).toString("base64url")}`;
}
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
/** RFC 7636 S256: BASE64URL(SHA256(verifier)) must equal the challenge. */
export function verifyPkce(verifier: string, challenge: string, method = "S256"): boolean {
  if (method !== "S256") return false;
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = crypto.createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed); const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a); const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
