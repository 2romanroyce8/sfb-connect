// Google testing-mode gate — pure rules (Roman, 2026-10-12).
// The OAuth app stays in TESTING MODE ON PURPOSE (bridge strategy until
// revenue funds Google verification + the restricted-scope assessment). Do
// not "fix" the gate by publishing the app. Testing mode admits only listed
// test users, capped at 100 — these rules keep a paying customer from ever
// reaching Google's "Access blocked" screen and keep us under the cap.

export const TEST_USER_CAP = 100;
export const ALERT_THRESHOLDS = [70, 85, 95] as const;   // 70 verification should be underway · 85 urgent · 95 block new clearances
export const BLOCK_AT = 95;
export const VERIFICATION_TASK_AT = 20;                  // auto-create "start Google verification" task once this many accounts are cleared/connected
export const CONSOLE_TEST_USERS_URL = "https://console.cloud.google.com/auth/audience?project=612333806040";

export type ClearanceStatus = "not_started" | "email_submitted" | "cleared" | "connected";

/** Only cleared/connected customers may start the Google OAuth handshake. Team members always may (owner connection is unaffected). */
export function canStartGoogleOAuth(status: ClearanceStatus | null | undefined, isTeam: boolean): boolean {
  if (isTeam) return true;
  return status === "cleared" || status === "connected";
}

export function normalizeGoogleEmail(input: unknown): string | null {
  const e = typeof input === "string" ? input.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

/** Counter the team sees. `count` = cleared + connected (both occupy a tester slot). */
export function counterLabel(count: number): string { return `Google test users: ${count} / ${TEST_USER_CAP}`; }

/** Which threshold alerts must fire when the count moves to `count`, given which already fired. */
export function alertsDue(count: number, alreadyFired: number[]): number[] {
  return ALERT_THRESHOLDS.filter((t) => count >= t && !alreadyFired.includes(t));
}
export function alertMessage(threshold: number, count: number): { title: string; body: string; priority: "high" | "urgent" } {
  if (threshold >= BLOCK_AT) return { title: `Google test users at ${count}/${TEST_USER_CAP} — new clearances BLOCKED`, body: "Customers now see the 'almost ready' state until Google verification completes. Finish verification to lift the block.", priority: "urgent" };
  if (threshold >= 85) return { title: `Google test users at ${count}/${TEST_USER_CAP} — URGENT`, body: "The 100-user testing cap is close. Verification must be finishing now.", priority: "urgent" };
  return { title: `Google test users at ${count}/${TEST_USER_CAP} — verification should be underway`, body: "Start / confirm the Google OAuth verification + restricted-scope assessment; it takes weeks to months.", priority: "high" };
}

/** New clearances are refused at the block threshold (or when the team flipped the block manually). */
export function clearancesBlocked(count: number, manualBlock: boolean): boolean { return manualBlock || count >= BLOCK_AT; }

/** The verification task is created exactly once, the first time the count reaches the threshold. */
export function shouldCreateVerificationTask(count: number, alreadyCreated: boolean): boolean { return !alreadyCreated && count >= VERIFICATION_TASK_AT; }

export const CUSTOMER_WAITING_COPY = "We're clearing your Google account — usually done within a few hours. We'll notify you the moment you can connect.";
export const CUSTOMER_BLOCKED_COPY = "Google connections are almost ready for new accounts — we're finishing a verification step with Google and will notify you the moment you can connect.";
export const CUSTOMER_DENIED_COPY = "Your Google account isn't cleared for connection yet — we've alerted the team and you'll be connected shortly.";
