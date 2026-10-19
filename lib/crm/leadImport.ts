// CSV lead importer — pure functions (Roman, 2026-10-18). Parsing is shared with
// the customer prospect uploader (lib/outbound/csvImport.ts parseCsv). Everything
// here is deterministic and tested; the DB writes live in the API route.
// Rules from the brief: business name AND phone required; phones normalized;
// dedupe by phone OR company name (case-insensitive) against existing leads and
// within the file; every skipped/errored row lands in the report with its row
// number and a reason — nothing is dropped silently.
import { parseCsv, type ParsedCsv } from "@/lib/outbound/csvImport";
import { normalizePhone } from "@/lib/notify/sms";

export { parseCsv };
export type { ParsedCsv };

export const LEAD_FIELDS = ["business_name", "website", "city", "state", "phone", "email", "notes", "tags", "group", "custom", "ignore"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];
export const LEAD_FIELD_LABELS: Record<LeadField, string> = {
  business_name: "Business name (required)", website: "Website", city: "City", state: "State", phone: "Phone (required)", email: "Email",
  notes: "Notes", tags: "Tags (comma-separated)", group: "Grouping column (for assignment)", custom: "Keep as custom field", ignore: "Skip this column",
};
export type LeadMapping = Record<string, LeadField>;

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const GUESS: [RegExp, LeadField][] = [
  [/^(businessname|business|company|companyname|name|org|organization)$/, "business_name"],
  [/^(website|site|url|domain|web)$/, "website"], [/^(city|town)$/, "city"], [/^(state|region|province|st)$/, "state"],
  [/^(phone|phonenumber|tel|telephone|mobile|cell)$/, "phone"], [/^(email|emailaddress|mail)$/, "email"],
  [/^(notes|note|comments|comment|description)$/, "notes"], [/^(tags|tag|labels)$/, "tags"],
  [/^(group|stategroup|territory|region_group|segment|bucket)$/, "group"],
];
/** Default mapping from headers (a remembered mapping, when present, is applied over this by the UI). */
export function suggestLeadMapping(headers: string[]): LeadMapping {
  const out: LeadMapping = {}; const used = new Set<LeadField>();
  for (const h of headers) {
    const n = norm(h); let f: LeadField = "custom";
    for (const [re, field] of GUESS) if (re.test(n) && (!used.has(field) || field === "custom")) { f = field; break; }
    if (f !== "custom" && f !== "ignore") used.add(f);
    out[h] = f;
  }
  return out;
}

export function validateLeadMapping(m: LeadMapping): string | null {
  const vals = Object.values(m);
  if (!vals.includes("business_name")) return "Map a column to Business name.";
  if (!vals.includes("phone")) return "Map a column to Phone.";
  for (const f of ["business_name", "website", "city", "state", "phone", "email", "notes", "tags", "group"] as LeadField[]) if (vals.filter((v) => v === f).length > 1) return `Two columns are mapped to ${LEAD_FIELD_LABELS[f]} — pick one.`;
  return null;
}

export type LeadRow = {
  row: number;                 // CSV line number (header = 1), for the report
  business_name: string; website: string | null; city: string | null; state: string | null;
  phone_raw: string; phone: string | null; email: string | null; notes: string | null; tags: string[]; group: string | null;
  custom: Record<string, string>;
};
export type RowIssue = { row: number; name: string; reason: "missing_name" | "missing_phone" | "invalid_phone" | "invalid_email" };

export const splitTags = (s: string | null | undefined) => Array.from(new Set((s ?? "").split(/[,;|]/).map((t) => t.trim().toLowerCase()).filter(Boolean)));
const cleanUrl = (s: string) => { const t = s.trim(); if (!t) return null; try { const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : ""); } catch { return t; } };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Values people type to mean "no email" — treated as blank (call-only lead), never as an error. `[email protected]` is Cloudflare's scraped-email placeholder. */
export const EMAIL_PLACEHOLDER_RE = /^(?:n\/?a|none|null|nil|tbd|unknown|no email|-+|—|–|\[email protected\]|\[email\s*protected\])$/i;
export const isPlaceholderEmail = (s: string) => EMAIL_PLACEHOLDER_RE.test(s.trim());

/** Map + validate every data row. Invalid rows are returned separately with a reason; valid rows carry a normalized phone. */
export function buildLeadRows(parsed: ParsedCsv, mapping: LeadMapping): { rows: LeadRow[]; issues: RowIssue[] } {
  const idx = parsed.headers.map((h) => ({ h, f: mapping[h] ?? "ignore" }));
  const rows: LeadRow[] = []; const issues: RowIssue[] = [];
  parsed.rows.forEach((cells, i) => {
    const row = i + 2; const get = (f: LeadField) => { const k = idx.findIndex((x) => x.f === f); return k >= 0 ? (cells[k] ?? "").trim() : ""; };
    const custom: Record<string, string> = {}; idx.forEach((x, k) => { if (x.f === "custom" && (cells[k] ?? "").trim()) custom[x.h] = cells[k].trim(); });
    const name = get("business_name"); const phoneRaw = get("phone"); const emailRaw = get("email"); const email = isPlaceholderEmail(emailRaw) ? "" : emailRaw;
    if (!name) { issues.push({ row, name: name || "(blank)", reason: "missing_name" }); return; }
    if (!phoneRaw) { issues.push({ row, name, reason: "missing_phone" }); return; }
    const phone = normalizePhone(phoneRaw);
    if (!phone) { issues.push({ row, name, reason: "invalid_phone" }); return; }
    if (email && !EMAIL_RE.test(email)) { issues.push({ row, name, reason: "invalid_email" }); return; }
    rows.push({ row, business_name: name, website: cleanUrl(get("website")), city: get("city") || null, state: get("state") || null, phone_raw: phoneRaw, phone, email: email ? email.toLowerCase() : null, notes: get("notes") || null, tags: splitTags(get("tags")), group: get("group") || null, custom });
  });
  return { rows, issues };
}

export const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export type ExistingLead = { id: string; business_name: string | null; phone_normalized: string | null };
export type DupGroup = {
  key: string;                       // stable id for the decision map
  rows: LeadRow[];                   // rows in this file that collide (first = primary)
  existing: ExistingLead[];          // existing leads they collide with
  why: ("phone" | "name")[];
};

/** Group rows that share a phone or a name with each other or with existing leads. Union-find over both keys. */
export function findDuplicates(rows: LeadRow[], existing: ExistingLead[]): { groups: DupGroup[]; singles: LeadRow[] } {
  const parent = rows.map((_, i) => i); const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  const byPhone = new Map<string, number>(), byName = new Map<string, number>();
  rows.forEach((r, i) => { if (r.phone) { const j = byPhone.get(r.phone); if (j !== undefined) union(i, j); else byPhone.set(r.phone, i); } const nk = nameKey(r.business_name); const j = byName.get(nk); if (j !== undefined) union(i, j); else byName.set(nk, i); });
  const exByPhone = new Map<string, ExistingLead[]>(), exByName = new Map<string, ExistingLead[]>();
  for (const e of existing) { if (e.phone_normalized) (exByPhone.get(e.phone_normalized) ?? exByPhone.set(e.phone_normalized, []).get(e.phone_normalized)!).push(e); if (e.business_name) { const k = nameKey(e.business_name); (exByName.get(k) ?? exByName.set(k, []).get(k)!).push(e); } }
  const buckets = new Map<number, number[]>(); rows.forEach((_, i) => { const r = find(i); (buckets.get(r) ?? buckets.set(r, []).get(r)!).push(i); });
  const groups: DupGroup[] = []; const singles: LeadRow[] = [];
  for (const idxs of buckets.values()) {
    const grs = idxs.map((i) => rows[i]); const ex = new Map<string, ExistingLead>(); const why = new Set<"phone" | "name">();
    for (const r of grs) { for (const e of r.phone ? exByPhone.get(r.phone) ?? [] : []) { ex.set(e.id, e); why.add("phone"); } for (const e of exByName.get(nameKey(r.business_name)) ?? []) { ex.set(e.id, e); why.add("name"); } }
    if (grs.length > 1) { const phones = new Set(grs.map((r) => r.phone)); const names = new Set(grs.map((r) => nameKey(r.business_name))); if (phones.size < grs.length) why.add("phone"); if (names.size < grs.length) why.add("name"); }
    if (grs.length > 1 || ex.size) groups.push({ key: `g${grs[0].row}`, rows: grs, existing: [...ex.values()], why: [...why] }); else singles.push(grs[0]);
  }
  return { groups, singles };
}

/** Merge several file rows into one lead: first row wins, blanks filled from later rows, tags unioned, notes joined, custom fields merged. */
export function mergeRows(rs: LeadRow[]): LeadRow {
  const [p, ...rest] = rs; const out: LeadRow = { ...p, tags: [...p.tags], custom: { ...p.custom } };
  const notes = [p.notes]; const cities = new Set(p.city ? [p.city] : []);
  for (const r of rest) {
    for (const k of ["website", "state", "email", "group"] as const) if (!out[k] && r[k]) (out as Record<string, unknown>)[k] = r[k];
    if (r.city && !cities.has(r.city)) cities.add(r.city);
    if (r.notes && !notes.includes(r.notes)) notes.push(r.notes);
    out.tags = Array.from(new Set([...out.tags, ...r.tags])); for (const [k, v] of Object.entries(r.custom)) if (!out.custom[k]) out.custom[k] = v;
  }
  out.city = cities.size ? [...cities].join(" / ") : null; // "Austin / San Antonio" — both markets kept
  out.notes = notes.filter(Boolean).join(" | ") || null;
  return out;
}

export type AssignmentRule = { column: "group" | string; map: Record<string, string> }; // value (case-insensitive) → user id
export function assigneeFor(row: LeadRow, rule: AssignmentRule | null): string | null {
  if (!rule) return null; const v = rule.column === "group" ? row.group : row.custom[rule.column] ?? null; if (!v) return null;
  const hit = Object.entries(rule.map).find(([k]) => k.trim().toLowerCase() === v.trim().toLowerCase()); return hit ? hit[1] : null;
}

export type RangeTags = { lastN: number; tags: string[] };
/** Extra tags for the last N data rows of the file (e.g. 'priority-dossier' on the last 15). Based on CSV position, not on survivors. */
export function tagsFor(row: LeadRow, global: string[], range: RangeTags | null, totalDataRows: number): string[] {
  const extra = range && range.lastN > 0 && row.row > totalDataRows + 1 - range.lastN ? range.tags : [];
  return Array.from(new Set([...global.map((t) => t.toLowerCase()), ...row.tags, ...extra.map((t) => t.toLowerCase())]));
}

export type ReportLine = { row: number; name: string; status: "imported" | "merged_in_file" | "merged_existing" | "skipped" | "error"; reason: string };
export type ImportOutcome = { total: number; imported: number; merged_in_file: number; merged_existing: number; skipped: number; errored: number; unassigned: number; lines: ReportLine[] };
export const emptyOutcome = (total: number): ImportOutcome => ({ total, imported: 0, merged_in_file: 0, merged_existing: 0, skipped: 0, errored: 0, unassigned: 0, lines: [] });
