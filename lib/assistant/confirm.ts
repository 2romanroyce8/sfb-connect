// Confirm-before-write: a write is proposed with a signed token; the confirm
// request must carry the exact same action, by the same user (and business,
// for clients), within 10 minutes. Nothing writes without it.
import crypto from "node:crypto";
import type { PendingAction } from "./types";

const TTL_MS = 10 * 60_000;
const secret = () => process.env.ASSISTANT_SECRET || process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "sfb-assistant";
const canon = (a: PendingAction) => JSON.stringify({ intent: a.intent, args: Object.fromEntries(Object.entries(a.args).sort(([x], [y]) => x.localeCompare(y))) });

export function signAction(a: PendingAction, scope: { role: "team" | "client"; userId: string; businessId?: string | null }, now = Date.now()): string {
  const exp = now + TTL_MS;
  const mac = crypto.createHmac("sha256", secret()).update(`${scope.role}|${scope.userId}|${scope.businessId ?? ""}|${exp}|${canon(a)}`).digest("hex");
  return `${exp}.${mac}`;
}

export function verifyAction(token: string, a: PendingAction, scope: { role: "team" | "client"; userId: string; businessId?: string | null }, now = Date.now()): boolean {
  const [expS, mac] = String(token ?? "").split("."); const exp = Number(expS);
  if (!exp || !mac || exp < now) return false;
  const want = crypto.createHmac("sha256", secret()).update(`${scope.role}|${scope.userId}|${scope.businessId ?? ""}|${exp}|${canon(a)}`).digest("hex");
  return want.length === mac.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac));
}
