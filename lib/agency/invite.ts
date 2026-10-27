import crypto from "node:crypto";
// Client invite tokens. The link carries a random token; the database stores only its SHA-256. Server-only (node:crypto).
export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;
export const newInviteToken = () => `sfbi_${crypto.randomBytes(32).toString("base64url")}`;
export const hashInviteToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export type InviteRow = { expires_at: string; accepted_at: string | null; email: string };
/** Why an invite can't be used by this signed-in email, or null if it can. Pure. */
export function inviteProblem(inv: InviteRow | null, userEmail: string | null | undefined, now = Date.now()): string | null {
  if (!inv) return "This invite link isn't valid.";
  if (inv.accepted_at) return "This invite was already used.";
  if (new Date(inv.expires_at).getTime() < now) return "This invite has expired. Ask your agency for a new one.";
  if (!userEmail || userEmail.trim().toLowerCase() !== inv.email.trim().toLowerCase()) return `This invite was sent to ${inv.email}. Sign in with that email address.`;
  return null;
}
