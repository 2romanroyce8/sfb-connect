import { Resend } from "resend";

/**
 * SFB Connect's own transactional sender (system service — never a customer
 * connection). Configured iff RESEND_API_KEY is set; RESEND_FROM_EMAIL is the
 * verified sender. Every send is best-effort: failures are logged and never
 * break the calling flow (a trial must still start if the welcome email fails).
 */
export const resendConfigured = (env: Record<string, string | undefined> = process.env) => !!(env.RESEND_API_KEY ?? "").trim();
const FROM_DEFAULT = "SFB Connect <hello@sfbconnect.com>";

export type SendResult = { sent: boolean; id?: string; skipped?: "not_configured"; error?: string };

export async function sendEmail(msg: { to: string; subject: string; html: string; text?: string; replyTo?: string }): Promise<SendResult> {
  if (!resendConfigured()) return { sent: false, skipped: "not_configured" };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { data, error } = await resend.emails.send({ from: (process.env.RESEND_FROM_EMAIL || FROM_DEFAULT).trim(), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, replyTo: msg.replyTo });
    if (error) { console.error("[email] resend error:", error.message); return { sent: false, error: error.message }; }
    return { sent: true, id: data?.id };
  } catch (e) {
    console.error("[email] send failed:", e instanceof Error ? e.message : e);
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#000;color:#f5f5f7;font-family:Inter,Helvetica,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8a8a8f">SFB Connect</div><h1 style="font-size:22px;margin:16px 0 12px;letter-spacing:-.02em">${title}</h1><div style="font-size:15px;line-height:1.6;color:#c9c9ce">${body}</div><div style="margin-top:32px;font-size:12px;color:#6e6e73">You're receiving this because you have an SFB Connect account. Sign in: <a style="color:#f5f5f7" href="https://www.sfbconnect.com/login">sfbconnect.com/login</a></div></div></body></html>`;

/** Trial welcome: what they got, how long it lasts, where to look. */
export function trialWelcomeEmail(p: { name: string; credits: number; days: number; businessName: string }) {
  return {
    subject: `Your SFB Agent is running — ${p.credits} credits, ${p.days} days`,
    html: shell(`Welcome, ${p.name}.`, `<p>Your agent is already working on <strong>${p.businessName}</strong> — a demo business on stock data, so nothing real is sent.</p><p>You have <strong>${p.credits} credits</strong> and <strong>${p.days} days</strong>. Every action and its credit receipt shows in your dashboard; the three capabilities you picked are the ones to watch.</p><p><a style="color:#f5f5f7" href="https://www.sfbconnect.com/dashboard/agent">Open your dashboard →</a></p>`),
    text: `Welcome, ${p.name}. Your SFB Agent is running on ${p.businessName} (demo data, no real sends). ${p.credits} credits, ${p.days} days. Dashboard: https://www.sfbconnect.com/dashboard/agent`,
  };
}

/** 80% usage warning (fires once per cycle, see guards.ts). */
export function creditWarningEmail(p: { businessName: string; balance: number; allotment: number; usedPct: number }) {
  return {
    subject: `${p.usedPct}% of this month's credits used — ${p.businessName}`,
    html: shell(`${p.usedPct}% of your credits are used.`, `<p><strong>${p.balance}</strong> of ${p.allotment} credits remain for <strong>${p.businessName}</strong>.</p><p>At zero the agent pauses — you are never charged beyond what you bought. Top up any time, or wait for your monthly refill.</p><p><a style="color:#f5f5f7" href="https://www.sfbconnect.com/dashboard/credits">See the ledger / top up →</a></p>`),
    text: `${p.usedPct}% of credits used for ${p.businessName}: ${p.balance} of ${p.allotment} remain. At zero the agent pauses; never overcharged. https://www.sfbconnect.com/dashboard/credits`,
  };
}

/** Work paused at zero. */
export function creditsExhaustedEmail(p: { businessName: string }) {
  return {
    subject: `Agent paused — ${p.businessName} is out of credits`,
    html: shell(`Your agent has paused.`, `<p><strong>${p.businessName}</strong> reached zero credits, so work stopped — exactly as promised, no overage.</p><p>Everything already done stays in your dashboard. Top up to resume, or wait for the monthly refill.</p><p><a style="color:#f5f5f7" href="https://www.sfbconnect.com/dashboard/credits">Top up →</a></p>`),
    text: `${p.businessName} is out of credits; the agent paused (no overage). Top up: https://www.sfbconnect.com/dashboard/credits`,
  };
}
