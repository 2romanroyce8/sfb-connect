// Customer list upload (Roman, 2026-10-12): a customer brings their own leads
// as a CSV — B2C lanes (their buyers are consumers, which business prospecting
// never finds) and agencies running outreach for clients. Pure functions here:
// parse, suggest a column mapping, validate, dedupe, count. The DB write lives
// in importProspects (server). Importing costs 0 credits; everything after it
// (reading a site, drafting, approving) follows the normal per-action prices.

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

/** Where a CSV column can land. `custom` keeps the column under its own header in custom_fields. */
export const IMPORT_FIELDS = ["name", "email", "company", "phone", "website", "city", "state", "first_name", "last_name", "custom", "ignore"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Contact name", email: "Email (required)", company: "Company / business", phone: "Phone", website: "Website", city: "City", state: "State",
  first_name: "First name", last_name: "Last name", custom: "Keep as custom field", ignore: "Skip this column",
};

export type ParsedCsv = { headers: string[]; rows: string[][]; truncated: boolean };

/** RFC 4180-ish parser: quoted fields, doubled quotes, CR/LF/CRLF, BOM, ragged rows padded. Delimiter auto-detected (, ; tab). */
export function parseCsv(text: string, maxRows = IMPORT_MAX_ROWS): ParsedCsv {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => ({ d, n: (firstLine.match(new RegExp(d === "\t" ? "\t" : `\\${d}`, "g")) ?? []).length })).sort((a, b) => b.n - a.n)[0].d;
  const out: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') { q = true; continue; }
    if (c === delim) { row.push(cell); cell = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(cell); cell = ""; if (row.some((x) => x.trim() !== "")) out.push(row); row = []; continue; }
    cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== "")) out.push(row);
  if (!out.length) return { headers: [], rows: [], truncated: false };
  const headers = out[0].map((h, i) => (h.trim() || `Column ${i + 1}`).slice(0, 80));
  const body = out.slice(1).map((r) => headers.map((_, i) => (r[i] ?? "").trim()));
  return { headers, rows: body.slice(0, maxRows), truncated: body.length > maxRows };
}

// Headers are compared with every non-alphanumeric stripped ("E-Mail Address" → "emailaddress").
const H: [ImportField, RegExp][] = [
  ["email", /^(email|emailaddress|contactemail|workemail|primaryemail|mail|emails)$/],
  ["first_name", /^(firstname|fname|givenname|first)$/],
  ["last_name", /^(lastname|lname|surname|familyname|last)$/],
  ["name", /^(fullname|contact|contactname|name|owner|person|leadname|customer|customername|ownername)$/],
  ["company", /^(company|companyname|business|businessname|organization|organisation|org|account|employer|firm|accountname)$/],
  ["phone", /^(phone|phonenumber|mobile|cell|cellphone|telephone|tel|contactnumber|phoneno)$/],
  ["website", /^(website|websiteurl|url|domain|site|homepage|web)$/],
  ["city", /^(city|town|locality)$/],
  ["state", /^(state|province|region|st)$/],
];

/** Best-guess mapping from messy headers. Anything unrecognised becomes a custom field; the customer confirms on the mapping screen. */
export function suggestMapping(headers: string[]): Record<string, ImportField> {
  const used = new Set<ImportField>(); const m: Record<string, ImportField> = {};
  for (const h of headers) {
    const key = h.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const hit = H.find(([f, re]) => re.test(key) && !used.has(f));
    const f: ImportField = hit ? hit[0] : "custom";
    if (f !== "custom") used.add(f);
    m[h] = f;
  }
  return m;
}

export type ImportRow = { name: string; contact_name: string | null; email: string; phone: string | null; website: string | null; city: string | null; state: string | null; custom: Record<string, string> };
export type SkipReason = "invalid_email" | "missing_name" | "duplicate_in_file" | "duplicate_existing" | "error";
export type ImportReport = { total: number; imported: number; skipped: number; reasons: Record<SkipReason, number>; examples: Partial<Record<SkipReason, string[]>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** "Royce, Roman" → "Roman Royce" (a single comma with text both sides is the Last, First convention); anything else untouched. */
export function normalizePersonName(s: string): string {
  const m = /^([^,]+),\s*([^,]+)$/.exec(s.trim());
  return m ? `${m[2].trim()} ${m[1].trim()}` : s.trim();
}
export const emptyReport = (total = 0): ImportReport => ({ total, imported: 0, skipped: 0, reasons: { invalid_email: 0, missing_name: 0, duplicate_in_file: 0, duplicate_existing: 0, error: 0 }, examples: {} });
export function skip(r: ImportReport, reason: SkipReason, example?: string) { r.skipped++; r.reasons[reason]++; if (example) { (r.examples[reason] ??= []); if (r.examples[reason]!.length < 3) r.examples[reason]!.push(example); } }

/** Mapping must name an email column and something that yields a name (name, first/last, or company). */
export function validateMapping(mapping: Record<string, ImportField>): string | null {
  const vals = Object.values(mapping);
  if (!vals.includes("email")) return "Point one column to Email — it's how your agent reaches these people.";
  if (!vals.some((v) => v === "name" || v === "company" || v === "first_name" || v === "last_name")) return "Point one column to a name or company so each lead has something to be called.";
  const dup = (["email", "name", "company", "phone", "website", "city", "state", "first_name", "last_name"] as ImportField[]).find((f) => vals.filter((v) => v === f).length > 1);
  if (dup) return `Two columns are both mapped to ${FIELD_LABELS[dup]} — pick one.`;
  return null;
}

/** Apply the mapping: valid rows (email ok, has a name, unique in file) + the skip report. Pure; existing-list dedupe happens server-side. */
export function buildRows(parsed: ParsedCsv, mapping: Record<string, ImportField>): { rows: ImportRow[]; report: ImportReport } {
  const report = emptyReport(parsed.rows.length); const rows: ImportRow[] = []; const seen = new Set<string>();
  const idx = (f: ImportField) => parsed.headers.findIndex((h) => mapping[h] === f);
  const col = (r: string[], f: ImportField) => { const i = idx(f); return i >= 0 ? (r[i] ?? "").trim() : ""; };
  const customCols = parsed.headers.map((h, i) => ({ h, i })).filter(({ h }) => mapping[h] === "custom");
  for (const r of parsed.rows) {
    const email = col(r, "email").toLowerCase();
    if (!EMAIL.test(email)) { skip(report, "invalid_email", email || "(blank)"); continue; }
    const person = col(r, "name") || [col(r, "first_name"), col(r, "last_name")].filter(Boolean).join(" ");
    const company = col(r, "company");
    const name = (company || person).slice(0, 200);
    if (!name) { skip(report, "missing_name", email); continue; }
    if (seen.has(email)) { skip(report, "duplicate_in_file", email); continue; }
    seen.add(email);
    const custom: Record<string, string> = {}; for (const { h, i } of customCols) if ((r[i] ?? "").trim()) custom[h.slice(0, 60)] = (r[i] ?? "").trim().slice(0, 500);
    rows.push({ name: normalizePersonName(name), contact_name: person ? normalizePersonName(person).slice(0, 120) : null, email, phone: col(r, "phone") || null, website: col(r, "website") || null, city: col(r, "city") || null, state: (col(r, "state") || null)?.toUpperCase().slice(0, 40) ?? null, custom });
  }
  return { rows, report };
}
