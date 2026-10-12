// Server side of the CSV upload: records the upload, inserts each valid row as
// a prospect tagged source="upload", dedupes against the existing list (by
// email, and by website domain when present), and returns honest counts.
// 0 credits — nothing is read, written or sent here.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addProspect, OutboundError, type Actor } from "./engine";
import { buildRows, parseCsv, suggestMapping, validateMapping, skip, IMPORT_MAX_BYTES, type ImportField, type ImportReport } from "./csvImport";

export type ImportPreview = { headers: string[]; suggested: Record<string, ImportField>; sample: string[][]; totalRows: number; truncated: boolean };

export function previewCsv(csv: string): ImportPreview | { error: string } {
  if (typeof csv !== "string" || !csv.trim()) return { error: "That file is empty." };
  if (Buffer.byteLength(csv, "utf8") > IMPORT_MAX_BYTES) return { error: "That file is over 2 MB — split it and upload in parts." };
  const parsed = parseCsv(csv);
  if (!parsed.headers.length || !parsed.rows.length) return { error: "We couldn't find a header row and at least one lead in that file." };
  return { headers: parsed.headers, suggested: suggestMapping(parsed.headers), sample: parsed.rows.slice(0, 5), totalRows: parsed.rows.length, truncated: parsed.truncated };
}

export async function importProspects(service: SupabaseClient, input: { businessId: string; filename: string; csv: string; mapping: Record<string, ImportField> }, actor: Actor & { kind: "user"; id: string }): Promise<{ importId: string; report: ImportReport } | { error: string }> {
  if (Buffer.byteLength(input.csv ?? "", "utf8") > IMPORT_MAX_BYTES) return { error: "That file is over 2 MB — split it and upload in parts." };
  const parsed = parseCsv(input.csv ?? "");
  if (!parsed.headers.length || !parsed.rows.length) return { error: "We couldn't find a header row and at least one lead in that file." };
  const mapping: Record<string, ImportField> = {}; for (const h of parsed.headers) mapping[h] = input.mapping?.[h] ?? "ignore";
  const bad = validateMapping(mapping); if (bad) return { error: bad };
  const { rows, report } = buildRows(parsed, mapping);
  const filename = (input.filename || "upload.csv").replace(/[^\w.\- ()]+/g, "_").slice(0, 120);

  const { data: imp, error: impErr } = await service.from("outbound_imports").insert({ business_id: input.businessId, filename, uploaded_by: actor.label, uploaded_by_user: actor.id, mapping, counts: {} }).select("id").single();
  if (impErr || !imp) return { error: impErr?.message || "Could not record the upload." };

  // Existing list: emails + domains already on this business (uploaded leads must not duplicate agent-found ones or earlier uploads).
  const { data: existing } = await service.from("outbound_prospects").select("email, canonical_domain").eq("business_id", input.businessId);
  const emails = new Set<string>((existing ?? []).map((p) => (p.email as string | null)?.toLowerCase()).filter((x): x is string => !!x));
  const domains = new Set<string>((existing ?? []).map((p) => p.canonical_domain as string | null).filter((x): x is string => !!x));
  const domainOf = (w: string | null) => { if (!w) return null; try { return new URL(/^https?:/i.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } };

  for (const r of rows) {
    if (emails.has(r.email)) { skip(report, "duplicate_existing", r.email); continue; }
    const d = domainOf(r.website);
    // Consumer leads often share a free-mail domain and businesses can share a website; the domain key only applies when the row has a website.
    const website = d && domains.has(d) ? null : r.website;
    try {
      await addProspect(service, { businessId: input.businessId, name: r.name, contactName: r.contact_name, email: r.email, phone: r.phone, website, city: r.city, state: r.state, source: "upload", importId: imp.id as string, customFields: r.custom }, actor);
      report.imported++; emails.add(r.email); if (d && website) domains.add(d);
    } catch (e) {
      if (e instanceof OutboundError && e.code === "duplicate") skip(report, "duplicate_existing", r.email);
      else skip(report, "error", e instanceof Error ? e.message.slice(0, 80) : "failed");
    }
  }
  await service.from("outbound_imports").update({ counts: report }).eq("id", imp.id);
  return { importId: imp.id as string, report };
}
