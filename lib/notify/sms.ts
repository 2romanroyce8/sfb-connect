// Owner SMS alerts via carrier email-to-SMS gateways (Roman, 2026-10-12).
// Pure module — no I/O. The carrier table says what each carrier has actually
// published; we do not list a gateway as working when the carrier says it is
// gone. Notifications only: this path must never carry outreach.

export type CarrierStatus = "active" | "unconfirmed" | "sunsetting" | "shutdown" | "none";
export type Carrier = { key: string; label: string; gateway: string | null; status: CarrierStatus; note: string };

export const CARRIERS: Carrier[] = [
  { key: "verizon", label: "Verizon", gateway: "vtext.com", status: "sunsetting", note: "Verizon is shutting email-to-text down by Mar 31, 2027 and says some senders already fail. Test it." },
  { key: "tmobile", label: "T-Mobile", gateway: "tmomail.net", status: "unconfirmed", note: "T-Mobile has published no shutdown, but delivery has been widely reported as unreliable since late 2024. Test it." },
  { key: "att", label: "AT&T", gateway: null, status: "shutdown", note: "AT&T shut email-to-text down on Jun 17, 2025. Alerts go to email." },
  { key: "cricket", label: "Cricket", gateway: null, status: "shutdown", note: "Cricket (AT&T) shut email-to-text down on Jun 17, 2025. Alerts go to email." },
  { key: "google_fi", label: "Google Fi", gateway: "msg.fi.google.com", status: "active", note: "Documented by Google Fi." },
  { key: "us_cellular", label: "UScellular", gateway: "email.uscc.net", status: "unconfirmed", note: "No published status. Test it." },
  { key: "metro", label: "Metro by T-Mobile", gateway: "mymetropcs.com", status: "unconfirmed", note: "Runs on T-Mobile; same caveat. Test it." },
  { key: "mint", label: "Mint Mobile", gateway: "tmomail.net", status: "unconfirmed", note: "Runs on T-Mobile; same caveat. Test it." },
  { key: "visible", label: "Visible", gateway: "vtext.com", status: "sunsetting", note: "Runs on Verizon; same shutdown. Test it." },
  { key: "xfinity", label: "Xfinity Mobile", gateway: "vtext.com", status: "sunsetting", note: "Runs on Verizon; same shutdown. Test it." },
  { key: "boost", label: "Boost Mobile", gateway: "sms.myboostmobile.com", status: "unconfirmed", note: "No published status. Test it." },
  { key: "other", label: "Other / VoIP (Google Voice, OpenPhone…)", gateway: null, status: "none", note: "No email-to-text gateway exists for this line. Alerts go to email." },
];

export const carrier = (key: string | null | undefined): Carrier | null => CARRIERS.find((c) => c.key === key) ?? null;

/** 10 US digits or null. Accepts "(213) 523-1641", "+1 213…", "12135231641". */
export function normalizePhone(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return /^[2-9]\d{9}$/.test(ten) ? ten : null;
}

/** Gateway address for a phone + carrier, or null when there is no live gateway. */
export function gatewayAddress(phone: string | null | undefined, carrierKey: string | null | undefined): string | null {
  const p = normalizePhone(phone); const c = carrier(carrierKey);
  if (!p || !c?.gateway) return null;
  return `${p}@${c.gateway}`;
}

/** Gateways count non-GSM characters against a 70-char limit and mangle some; keep it plain ASCII. */
export function asciiSms(text: string): string {
  return text
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/·/g, "|").replace(/→/g, "->")
    .replace(/[^\x20-\x7E\n]/g, "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

export const SMS_MAX = 160;

/** One text when it fits; otherwise clean word-boundary parts, each prefixed "(i/n) " and still ≤ 160. */
export function splitSms(text: string, max = SMS_MAX): string[] {
  const t = asciiSms(text);
  if (t.length <= max) return [t];
  const words = t.split(/\s+/); const raw: string[] = [];
  // First pass with a generous prefix allowance (n ≤ 9 → "(i/n) " = 6 chars); re-run if n reached two digits.
  const build = (prefixLen: number) => {
    raw.length = 0; let cur = "";
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (candidate.length <= max - prefixLen) { cur = candidate; continue; }
      if (cur) raw.push(cur);
      // A single word longer than a part: hard-cut it.
      let rest = w; while (rest.length > max - prefixLen) { raw.push(rest.slice(0, max - prefixLen)); rest = rest.slice(max - prefixLen); } cur = rest;
    }
    if (cur) raw.push(cur);
  };
  build(6); if (raw.length > 9) build(8);
  const n = raw.length;
  return raw.map((p, i) => `(${i + 1}/${n}) ${p}`);
}

export type Trigger = "lead_new" | "demo_booked" | "callback_sla" | "credits_warning" | "credits_exhausted" | "approval_pending" | "system_health" | "sms_test";
/** Triggers the owner can switch off. callback_sla is a real ops commitment and always fires; sms_test is explicit. */
export const CONFIGURABLE_TRIGGERS: { key: Exclude<Trigger, "callback_sla" | "sms_test">; label: string; hint: string }[] = [
  { key: "lead_new", label: "New lead", hint: "Website lead forms, service inquiries, verified signups." },
  { key: "demo_booked", label: "Demo call booked", hint: "Every booking (the call-now alert is separate and always on)." },
  { key: "credits_warning", label: "Customer credits at 80%", hint: "A customer account is running low." },
  { key: "credits_exhausted", label: "Customer credits at zero", hint: "A customer's agent paused." },
  { key: "approval_pending", label: "Approval queue", hint: "An outbound draft is waiting for a human. Texts are coalesced to one per 10 minutes." },
  { key: "system_health", label: "System health", hint: "Hourly sync errors, a stalled cron, or a customer's Gmail/Calendar connection that died. One text per hour at most." },
];

export type NotifyUser = {
  id: string; email: string | null;
  notify_phone: string | null; notify_carrier: string | null; notify_prefs: Record<string, boolean> | null;
  notify_sms_verified_at: string | null; notify_sms_last_bounce_at: string | null;
};
export type ChannelDecision = {
  wantSms: boolean;                      // trigger is on for this user
  gateway: string | null;                // where the SMS goes, when it can go anywhere
  smsSkipReason: string | null;          // no_phone | no_carrier | carrier_shutdown | recent_bounce | pref_off | null
  email: boolean;                        // whether an email goes out too (critical, fallback, or SMS not yet verified)
  emailReason: "critical" | "fallback" | "unverified_sms" | "pref_off" | null;
};

export const BOUNCE_BACKOFF_DAYS = 7;

/** Pure routing decision. Critical triggers (callback_sla) always email; SMS always falls back to email when it cannot go out. */
export function decideChannels(u: NotifyUser, trigger: Trigger, now = new Date()): ChannelDecision {
  const critical = trigger === "callback_sla";
  const prefOn = critical || trigger === "sms_test" || (u.notify_prefs?.[trigger] ?? true);
  if (!prefOn) return { wantSms: false, gateway: null, smsSkipReason: "pref_off", email: false, emailReason: "pref_off" };
  const phone = normalizePhone(u.notify_phone); const c = carrier(u.notify_carrier);
  let gateway: string | null = null; let skip: string | null = null;
  if (!phone) skip = "no_phone";
  else if (!c) skip = "no_carrier";
  else if (!c.gateway) skip = c.status === "shutdown" ? "carrier_shutdown" : "no_gateway";
  else if (u.notify_sms_last_bounce_at && now.getTime() - Date.parse(u.notify_sms_last_bounce_at) < BOUNCE_BACKOFF_DAYS * 86_400_000) skip = "recent_bounce";
  else gateway = `${phone}@${c.gateway}`;
  if (critical) return { wantSms: true, gateway, smsSkipReason: skip, email: true, emailReason: "critical" };
  if (!gateway) return { wantSms: true, gateway: null, smsSkipReason: skip, email: trigger !== "sms_test", emailReason: trigger !== "sms_test" ? "fallback" : null };
  const unverified = !u.notify_sms_verified_at;
  return { wantSms: true, gateway, smsSkipReason: null, email: unverified && trigger !== "sms_test", emailReason: unverified && trigger !== "sms_test" ? "unverified_sms" : null };
}

/** Minutes within which a second approval_pending text to the same person is coalesced. */
export const COALESCE_MINUTES: Partial<Record<Trigger, number>> = { approval_pending: 10, system_health: 60 };
