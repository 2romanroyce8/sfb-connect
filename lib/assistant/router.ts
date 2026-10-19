// Dashboard assistant — Layer 1 intent router. Pure, $0, instant: no model,
// no network. Maps a message to { intent, slots } for the team or client
// assistant. Anything it can't match returns null → Layer 2 (LLM) or help.
import { PIPELINE_STAGES } from "@/lib/crm/stages";

export type Role = "team" | "client";
export type Slots = { lead?: string; leadId?: string; stage?: string; state?: string; tag?: string; when?: string; dueAt?: string; text?: string; rep?: string; name?: string; email?: string; days?: number; messageId?: string };
export type Routed = { intent: string; slots: Slots; write: boolean };

// ---------- vocab ----------
const STATES: Record<string, string> = { alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY" };
const STATE_CODES = new Set(Object.values(STATES));
const STAGE_SYNONYMS: [RegExp, string][] = [
  [/\bdemo done\b|\bmeeting completed\b|\bdemo completed\b/, "meeting_completed"],
  [/\bmeeting booked\b|\bbooked\b/, "meeting_booked"],
  [/\bready to call\b/, "ready_to_call"],
  [/\bfollow[- ]?up\b(?! for| on| with)/, "follow_up"],
  [/\bbook demo\b|\bdemo requested\b|\bpending demo\b/, "demo_requested"],
  ...PIPELINE_STAGES.map((s) => [new RegExp(`\\b${s.label.toLowerCase().replace(/[()]/g, "").replace(/\s+/g, "[ _-]?")}\\b`), s.value] as [RegExp, string]),
  [/\bnew\b/, "new"], [/\bcontacted\b/, "contacted"], [/\binterested\b/, "interested"], [/\bproposal\b/, "proposal"], [/\bwon\b|\bclosed won\b/, "won"], [/\blost\b|\bdead\b/, "lost"], [/\bnurture\b/, "nurture"], [/\bresearching\b/, "researching"],
];

export function findStage(t: string): string | undefined { for (const [re, v] of STAGE_SYNONYMS) if (re.test(t)) return v; return undefined; }
export function findState(raw: string): string | undefined {
  const t = raw.toLowerCase();
  for (const [name, code] of Object.entries(STATES).sort((a, b) => b[0].length - a[0].length)) if (new RegExp(`\\b${name}\\b`).test(t)) return code;
  const m = raw.match(/\b([A-Z]{2})\b/g); if (m) for (const c of m) if (STATE_CODES.has(c) && !["OK", "IN", "ME", "OR", "HI", "AS"].includes(c)) return c;
  const m2 = raw.match(/\b(OK|IN|ME|OR|HI)\s+leads\b/); if (m2) return m2[1];
  return undefined;
}
const findTag = (t: string) => t.match(/\b(?:tag(?:ged)?|label(?:led)?)\s+(?:with\s+|as\s+)?#?([a-z0-9][a-z0-9-]{1,40})\b/)?.[1] ?? t.match(/#([a-z0-9][a-z0-9-]{1,40})/)?.[1] ?? (t.match(/\b([a-z0-9]+-[a-z0-9-]+)\b/)?.[1] ?? undefined);

// ---------- dates (America/New_York) ----------
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function etParts(d: Date) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long", hour: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value])); return { y: +p.year, m: +p.month, d: +p.day, wd: DAYS.indexOf(String(p.weekday).toLowerCase()), h: +p.hour }; }
/** ET wall-clock → UTC ISO. */
export function etToIso(y: number, m: number, d: number, hh: number, mm: number): string {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  for (const off of [4, 5]) { const t = new Date(guess + off * 3600e3); const p = etParts(t); const hm = +new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", minute: "2-digit" }).format(t); if (p.d === d && p.h === hh && hm === mm) return t.toISOString(); }
  return new Date(guess + 4 * 3600e3).toISOString();
}
/** "tomorrow", "tuesday", "next friday", "in 3 days", "oct 22", "10/22", optional "at 2pm" / "2:30 pm". Default time 10:00 ET. */
export function parseWhen(raw: string, now: Date = new Date()): { dueAt: string; label: string } | null {
  const t = raw.toLowerCase();
  const base = etParts(now); let y = base.y, m = base.m, d = base.d; let found = false; let label = "";
  const add = (n: number) => { const x = new Date(Date.UTC(y, m - 1, d + n)); y = x.getUTCFullYear(); m = x.getUTCMonth() + 1; d = x.getUTCDate(); };
  if (/\btoday\b|\btonight\b/.test(t)) { found = true; label = "today"; }
  else if (/\btomorrow\b|\btmrw\b|\btmr\b/.test(t)) { add(1); found = true; label = "tomorrow"; }
  else if (/\bin (\d{1,2}) days?\b/.test(t)) { const n = +t.match(/\bin (\d{1,2}) days?\b/)![1]; add(n); found = true; label = `in ${n} days`; }
  else if (/\bnext week\b/.test(t)) { add(7); found = true; label = "next week"; }
  else {
    const wd = DAYS.findIndex((x) => new RegExp(`\\b(next |this )?${x}\\b`).test(t) || new RegExp(`\\b${x.slice(0, 3)}\\b`).test(t));
    if (wd >= 0) { let diff = (wd - base.wd + 7) % 7; if (diff === 0 || /\bnext\b/.test(t)) diff = diff === 0 ? 7 : diff; add(diff); found = true; label = DAYS[wd][0].toUpperCase() + DAYS[wd].slice(1); }
    const md = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/) ; const sl = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (md) { const mo = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(md[1]) + 1; y = mo < base.m || (mo === base.m && +md[2] < base.d) ? base.y + 1 : base.y; m = mo; d = +md[2]; found = true; label = `${md[1][0].toUpperCase()}${md[1].slice(1)} ${d}`; }
    else if (sl) { m = +sl[1]; d = +sl[2]; y = m < base.m ? base.y + 1 : base.y; found = true; label = `${m}/${d}`; }
  }
  const tm = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? t.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
  let hh = 10, mm = 0; if (tm) { hh = +tm[1] % 12; mm = tm[2] ? +tm[2] : 0; if (tm[3] === "pm") hh += 12; if (!tm[3] && hh < 7) hh += 12; label += `${label ? " " : ""}at ${tm[0].replace(/^at\s+/, "")}`; if (!found) { found = true; } }
  if (!found) return null;
  return { dueAt: etToIso(y, m, d, hh, mm), label: label || "soon" };
}

// ---------- helpers ----------
const clean = (s: string) => s.replace(/^[\s"'“”]+|[\s"'“”.?!,:]+$/g, "").replace(/\s+/g, " ").trim();
const leadIdOf = (t: string) => t.match(/\blead:([0-9a-f-]{36})\b/i)?.[1];
const msgIdOf = (t: string) => t.match(/\bmsg:([0-9a-f-]{36})\b/i)?.[1];
const stripWhen = (s: string) => s.replace(/\b(today|tonight|tomorrow|tmrw|tmr|next week|in \d{1,2} days?|(next |this )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}|\d{1,2}\/\d{1,2}|(at )?\d{1,2}(:\d{2})?\s*(am|pm)|at \d{1,2}:\d{2})\b/gi, " ");

type Rule = { intent: string; write?: boolean; roles: Role[]; test: RegExp; slots?: (raw: string, t: string) => Slots | null };

const RULES: Rule[] = [
  // ======== shared ========
  { intent: "help", roles: ["team", "client"], test: /^(help|\?|what can you do|commands|how do (i|you) use (this|you))\b/ },
  { intent: "greeting", roles: ["team", "client"], test: /^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b[\s!.]*$/ },

  // ======== TEAM — writes (checked first: "move X to Y" contains stage words) ========
  { intent: "move_stage", write: true, roles: ["team"], test: /\b(move|set|change|put|mark|drag)\b.+\b(to|as|into|in)\b/, slots: (raw, t) => {
    const m = raw.match(/\b(?:move|set|change|put|mark|drag)\s+(.+?)\s+(?:to|as|into|in)\s+(?:the\s+)?(.+?)(?:\s+stage)?[.!?]*$/i); if (!m) return null;
    const stage = findStage(m[2].toLowerCase()); if (!stage) return null;
    return { lead: clean(m[1].replace(/\b(lead|the)\b/gi, "")), leadId: leadIdOf(raw), stage };
  } },
  { intent: "add_followup", write: true, roles: ["team"], test: /\b(add|schedule|set|create|book|remind me)\b.*\b(follow[- ]?up|callback|call back|reminder|remind)\b|\bfollow[- ]?up (with|for|on)\b|\bremind me to (call|follow)/, slots: (raw, t) => {
    const when = parseWhen(t); const m = raw.match(/\b(?:for|with|on|call|to)\s+(.+)$/i);
    const lead = m ? clean(stripWhen(m[1]).replace(/\b(follow[- ]?up|callback|call back|at|on|for|a|the|lead)\b/gi, " ")) : undefined;
    return { lead, leadId: leadIdOf(raw), dueAt: when?.dueAt, when: when?.label };
  } },
  { intent: "complete_followup", write: true, roles: ["team"], test: /\b(mark|set|complete|finish|close|done)\b.*\bfollow[- ]?up\b.*\b(done|complete|completed|finished)?\b|\bfollow[- ]?up\b.*\b(is )?(done|complete)\b/, slots: (raw) => {
    const m = raw.match(/\b(?:for|with|on)\s+(.+?)(?:\s+(?:as\s+)?(?:done|complete|completed|finished))?[.!]*$/i) ?? raw.match(/\b(?:mark|complete|finish|close)\s+(?:the\s+)?(.+?)\s+follow[- ]?up/i);
    return { lead: m ? clean(m[1].replace(/\b(follow[- ]?up|the)\b/gi, "")) : undefined, leadId: leadIdOf(raw) };
  } },
  { intent: "add_note", write: true, roles: ["team"], test: /^(add (a )?note|note|log (a )?note)\b/, slots: (raw) => {
    const m = raw.match(/^(?:add (?:a )?note|note|log (?:a )?note)\s+(?:to|on|for)?\s*(.+?)\s*[:\-–—]\s*(.+)$/i); if (!m) return null;
    return { lead: clean(m[1]), leadId: leadIdOf(raw), text: m[2].trim().slice(0, 2000) };
  } },
  { intent: "untag_lead", write: true, roles: ["team"], test: /\b(untag|remove (the )?tag|remove tag)\b/, slots: (raw, t) => {
    const m = raw.match(/\b(?:untag|remove (?:the )?tag)\s+#?([a-z0-9][a-z0-9-]*)\s+from\s+(.+)$/i) ?? raw.match(/\buntag\s+(.+?)\s+(?:from\s+)?#?([a-z0-9][a-z0-9-]+)$/i);
    if (!m) return null; const [tag, lead] = /from/i.test(raw) ? [m[1], m[2]] : [m[2], m[1]];
    return { tag: tag.toLowerCase(), lead: clean(lead), leadId: leadIdOf(raw) };
  } },
  { intent: "tag_lead", write: true, roles: ["team"], test: /^(tag|label|add (the )?tag)\b/, slots: (raw) => {
    const m = raw.match(/^(?:tag|label)\s+(.+?)\s+(?:with|as)\s+#?([a-z0-9][a-z0-9-]*)$/i) ?? raw.match(/^add (?:the )?tag\s+#?([a-z0-9][a-z0-9-]*)\s+to\s+(.+)$/i);
    if (!m) return null; const add = /^add/i.test(raw);
    return { lead: clean(add ? m[2] : m[1]), tag: (add ? m[1] : m[2]).toLowerCase(), leadId: leadIdOf(raw) };
  } },
  { intent: "assign_lead", write: true, roles: ["team"], test: /\b(assign|reassign|give)\b.+\bto\b/, slots: (raw) => {
    const m = raw.match(/\b(?:assign|reassign|give)\s+(.+?)\s+to\s+(.+?)[.!]*$/i); if (!m) return null;
    return { lead: clean(m[1].replace(/\b(lead|the)\b/gi, "")), leadId: leadIdOf(raw), rep: clean(m[2]) };
  } },
  { intent: "archive_lead", write: true, roles: ["team"], test: /^(archive|delete|remove)\b(?!.*\btag\b)/, slots: (raw) => ({ lead: clean(raw.replace(/^(archive|delete|remove)\s+/i, "").replace(/\b(lead|the)\b/gi, "")), leadId: leadIdOf(raw) }) },

  // ======== TEAM — reads ========
  { intent: "navigate", roles: ["team"], test: /^(go to|open|take me to|show me the|navigate to)\s+(the\s+)?(dashboard|leads|pipeline|calls|meetings|calendar|follow[- ]?ups|outbound|research|audits|work plan|leaderboard|revenue|timesheets|notes|activity|settings|integrations|team|content lab|give hyperagent|agent tasks|client projects)( page| tab)?[.!]*$/, slots: (raw, t) => ({ text: t.replace(/^(go to|open|take me to|show me the|navigate to)\s+(the\s+)?/, "").replace(/( page| tab)?[.!]*$/, "") }) },
  { intent: "briefing", roles: ["team"], test: /\b(brief(ing)?|what'?s (on|up) (for )?today|my day|daily summary|what should i (do|work on)|catch me up|morning report)\b/ },
  { intent: "followups_overdue", roles: ["team"], test: /\b(overdue|late|missed|past due)\b.*\b(follow[- ]?ups?|callbacks?)?|\bfollow[- ]?ups?\b.*\b(overdue|late|missed)\b/ },
  { intent: "followups_today", roles: ["team"], test: /\b(follow[- ]?ups?|callbacks?)\b.*\b(today|due)\b|\bwho (do|should) i (call|follow up with)\b|\b(today'?s|due) follow[- ]?ups?\b/ },
  { intent: "followups_upcoming", roles: ["team"], test: /\b(follow[- ]?ups?|callbacks?)\b.*\b(this week|upcoming|coming up|tomorrow|next)\b|\b(my|all|list|show) follow[- ]?ups?\b/ },
  { intent: "meetings_today", roles: ["team"], test: /\b(meetings?|demos?|appointments?|calls? booked)\b.*\btoday\b|\btoday'?s (meetings?|demos?)\b/ },
  { intent: "meetings_upcoming", roles: ["team"], test: /\b(meetings?|demos?|appointments?)\b.*\b(this week|upcoming|coming up|tomorrow|next|scheduled|booked)\b|\b(my|show|list) (meetings?|demos?|calendar)\b|\bcalendar\b/ },
  { intent: "stuck_deals", roles: ["team"], test: /\b(stuck|stale|stalled|going cold|no activity|neglected|forgotten)\b/, slots: (raw, t) => ({ days: +(t.match(/\b(\d{1,3})\s*days?\b/)?.[1] ?? 7) }) },
  { intent: "pipeline_summary", roles: ["team"], test: /\b(pipeline|funnel|stages?|deals?)\b.*\b(summary|overview|breakdown|look|status)?\b|\bshow (me )?(my |the )?pipeline\b/, slots: (raw, t) => ({ state: findState(raw) }) },
  { intent: "calls_today", roles: ["team"], test: /\b(calls?|dials?)\b.*\b(today|made|i made|so far)\b|\bhow many (calls|dials)\b/ },
  { intent: "my_stats", roles: ["team"], test: /\b(my (stats|numbers|points|score|performance)|leaderboard|how am i doing|rank(ing)?)\b/ },
  { intent: "outbound_status", roles: ["team"], test: /\b(outbound|emails?|campaign|send window|approval queue|approvals?)\b/ },
  { intent: "research_status", roles: ["team"], test: /\b(research (queue|jobs?|status)|researching now|audits?)\b/ },
  { intent: "agent_tasks", roles: ["team"], test: /\b(agent tasks?|atlas|muse|hyperagent tasks?|give hyperagent|prompt queue)\b/ },
  { intent: "recent_leads", roles: ["team"], test: /\b(new|recent|latest|added)\b.*\bleads?\b.*\b(today|this week|recently|lately|yesterday)\b|\bleads? (added|created) (today|this week|yesterday)\b/ },
  { intent: "tag_list", roles: ["team"], test: /\b(what|which|list|show)\b.*\btags\b|\btags (do we have|in use)\b/ },
  { intent: "lead_count", roles: ["team"], test: /\bhow many\b.*\b(leads?|deals?|prospects?|businesses|companies)\b|\b(lead|deal) count\b|\bhow many\b.*\bin\b/, slots: (raw, t) => ({ stage: findStage(t.replace(/\bhow many\b/, "")), state: findState(raw), tag: /\btag/.test(t) || /-/.test(t) ? findTag(t) : undefined }) },
  { intent: "list_leads", roles: ["team"], test: /\b(list|show|which|what)\b.*\b(leads?|deals?)\b/, slots: (raw, t) => ({ stage: findStage(t.replace(/\b(list|show|which|what)\b/, "")), state: findState(raw), tag: /\btag/.test(t) || /-/.test(t) ? findTag(t) : undefined }) },
  { intent: "won_deals", roles: ["team"], test: /\b(won|closed|sold|signed)\b.*\b(this week|this month|today|lately|recently|so far)\b|\bwhat did we (close|win|sell)\b/, slots: (raw, t) => ({ days: /month/.test(t) ? 30 : /today/.test(t) ? 1 : 7 }) },
  { intent: "lead_details", roles: ["team"], test: /^(find|look ?up|search( for)?|show|open|pull up|details (for|on)|info (on|for)|who is|what about)\b/, slots: (raw) => ({ lead: clean(raw.replace(/^(find|look ?up|search( for)?|show( me)?|open|pull up|details (for|on)|info (on|for)|who is|what about)\s+/i, "").replace(/\b(the )?lead\b/gi, "")), leadId: leadIdOf(raw) }) },

  // ======== CLIENT — writes ========
  { intent: "c_approve", write: true, roles: ["client"], test: /\b(approve|send it|ok to send)\b/, slots: (raw) => ({ messageId: msgIdOf(raw), lead: clean(raw.replace(/^(approve|send it|ok to send)\s*(the )?(email|draft|message)?\s*(to|for)?\s*/i, "").replace(/msg:[0-9a-f-]{36}/i, "")) || undefined }) },
  { intent: "c_reject", write: true, roles: ["client"], test: /\b(reject|don'?t send|decline|cancel)\b.*\b(email|draft|message)?/, slots: (raw) => ({ messageId: msgIdOf(raw), lead: clean(raw.replace(/^(reject|don'?t send|decline|cancel)\s*(the )?(email|draft|message)?\s*(to|for)?\s*/i, "").replace(/msg:[0-9a-f-]{36}/i, "")) || undefined, text: raw.match(/\bbecause\s+(.+)$/i)?.[1] }) },
  { intent: "c_set_offer", write: true, roles: ["client"], test: /\b(change|set|update|make)\b.*\b(offer line|offer|pitch line)\b/, slots: (raw) => { const m = raw.match(/\b(?:to|:)\s*["“]?(.+?)["”]?$/i); return m ? { text: m[1].trim().slice(0, 300) } : {}; } },
  { intent: "c_add_prospect", write: true, roles: ["client"], test: /\badd\b.*\b(prospect|lead|contact|customer)\b/, slots: (raw) => {
    const email = raw.match(/[^\s<>()"']+@[^\s<>()"']+\.[a-z]{2,}/i)?.[0];
    const name = clean(raw.replace(/[^\s<>()"']+@[^\s<>()"']+\.[a-z]{2,}/i, "").replace(/^add\s+(a\s+)?(new\s+)?(prospect|lead|contact|customer)\s*:?\s*/i, "").replace(/\b(email|with|at|,)\b/gi, " "));
    return { name: name || undefined, email };
  } },
  { intent: "c_support", write: true, roles: ["client"], test: /\b(contact|message|talk to|email) (support|the team|a human|someone)\b|\b(support ticket|i need help with)\b/, slots: (raw) => ({ text: raw.replace(/^.*?(support|the team|a human|someone|help with)\s*[:\-–—]?\s*/i, "").trim() || undefined }) },

  // ======== CLIENT — reads ========
  { intent: "c_onboarding", roles: ["client"], test: /\b(set ?up|onboard(ing)?|get started|next step|what('?s| is) left|finish (my )?setup|how do i start)\b/ },
  { intent: "c_credits", roles: ["client"], test: /\b(credits?|balance|how much (do i have|is left)|top ?up)\b/ },
  { intent: "c_usage", roles: ["client"], test: /\b(usage|spent|spend|what did (i|you) (use|spend)|charges)\b/ },
  { intent: "c_plan", roles: ["client"], test: /\b(my plan|which plan|what plan|subscription|billing)\b/ },
  { intent: "c_prices", roles: ["client"], test: /\b(cost|price|pricing|how much does)\b/ },
  { intent: "c_approvals", roles: ["client"], test: /\b(approv|waiting|pending|drafts?|queue|review)\b/ },
  { intent: "c_sent", roles: ["client"], test: /\b(sent|emails? (went|gone) out|outreach (so far|this week)|what did you send)\b/ },
  { intent: "c_replies", roles: ["client"], test: /\b(repl(y|ies|ied)|responses?|answered|wrote back|interested)\b/ },
  { intent: "c_meetings", roles: ["client"], test: /\b(meetings?|bookings?|booked|appointments?|calendar|calls? scheduled)\b/ },
  { intent: "c_connections", roles: ["client"], test: /\b(gmail|google calendar|connected|connection|integrations?|disconnected)\b/ },
  { intent: "c_offer", roles: ["client"], test: /\b(offer line|my offer|pitch)\b/ },
  { intent: "c_report", roles: ["client"], test: /\b(report|results|performance|how('?s| is) it going|how are we doing)\b/ },
  { intent: "c_prospect_count", roles: ["client"], test: /\bhow many\b.*\b(prospects?|leads?|contacts?|people|businesses)\b/ },
  { intent: "c_list_prospects", roles: ["client"], test: /\b(list|show|who are|see)\b.*\b(prospects?|leads?|contacts?|list)\b/ },
  { intent: "c_find_prospect", roles: ["client"], test: /^(find|look ?up|search( for)?|what about|status of)\b/, slots: (raw) => ({ lead: clean(raw.replace(/^(find|look ?up|search( for)?|what about|status of)\s+/i, "")) }) },
];

export function route(message: string, role: Role, now: Date = new Date()): Routed | null {
  const raw = message.trim().slice(0, 1000); if (!raw) return null;
  const t = raw.toLowerCase();
  for (const r of RULES) {
    if (!r.roles.includes(role) || !r.test.test(t)) continue;
    const slots = r.slots ? r.slots(raw, t) : {};
    if (slots === null) continue;
    if (r.intent === "add_followup" && !slots.dueAt) { const w = parseWhen(t, now); if (w) { slots.dueAt = w.dueAt; slots.when = w.label; } }
    return { intent: r.intent, slots, write: !!r.write };
  }
  return null;
}

/** Intent catalogues (for help text, the LLM tool list later, and the coverage test). */
export const TEAM_INTENTS = Array.from(new Set(RULES.filter((r) => r.roles.includes("team")).map((r) => r.intent)));
export const CLIENT_INTENTS = Array.from(new Set(RULES.filter((r) => r.roles.includes("client")).map((r) => r.intent)));
