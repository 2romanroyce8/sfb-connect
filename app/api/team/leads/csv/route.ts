import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { IMPORT_MAX_BYTES } from "@/lib/outbound/csvImport";
import { parseCsv, suggestLeadMapping, validateLeadMapping, buildLeadRows, findDuplicates, mergeRows, assigneeFor, tagsFor, emptyOutcome, type LeadMapping, type AssignmentRule, type RangeTags, type LeadRow, type ExistingLead, type ImportOutcome } from "@/lib/crm/leadImport";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STAGES = ["demo_requested", "new", "researching", "ready_to_call", "contacted", "interested", "follow_up", "meeting_booked", "proposal", "won", "lost", "nurture"];

async function caller() {
  const supabase = createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { data: me } = await supabase.from("users").select("id, full_name, email, team_role").eq("id", user.id).single();
  return me?.team_role ? (me as { id: string; full_name: string | null; email: string; team_role: string }) : null;
}
type Options = { tags: string[]; rangeTags: RangeTags | null; stage: string; assignment: AssignmentRule | null; decisions: Record<string, "merge" | "skip">; filename: string; savePrefs: boolean };

async function loadExisting(service: ReturnType<typeof createSupabaseServiceClient>): Promise<ExistingLead[]> {
  const out: ExistingLead[] = []; let from = 0;
  for (;;) { const { data } = await service.from("crm_leads").select("id, business_name, phone_normalized").eq("archived", false).range(from, from + 999); if (!data?.length) break; out.push(...(data as ExistingLead[])); if (data.length < 1000) break; from += 1000; }
  return out;
}

/** GET → remembered mapping + team members + stages (what the importer UI needs before a file is chosen). */
export async function GET() {
  const me = await caller(); if (!me) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const service = createSupabaseServiceClient();
  const [{ data: prefs }, { data: team }, { count }] = await Promise.all([
    service.from("crm_lead_import_prefs").select("mapping, options").eq("user_id", me.id).maybeSingle(),
    service.from("users").select("id, full_name, email, team_role").not("team_role", "is", null).neq("team_status", "disabled").order("full_name"),
    service.from("crm_leads").select("id", { count: "exact", head: true }),
  ]);
  return NextResponse.json({ prefs: prefs ?? null, team: team ?? [], stages: STAGES, existingCount: count ?? 0, maxBytes: IMPORT_MAX_BYTES });
}

/**
 * POST action=preview {csv, mapping?} → headers, suggested/validated mapping, first 10 mapped rows, issues, duplicate groups, counts.
 * POST action=commit  {csv, mapping, options} → text/event-stream: {type:"progress", done, total} … {type:"done", importId, outcome}
 */
export async function POST(req: NextRequest) {
  const me = await caller(); if (!me) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; csv?: string; mapping?: LeadMapping; options?: Partial<Options> };
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "Empty file." }, { status: 400 });
  if (Buffer.byteLength(csv, "utf8") > IMPORT_MAX_BYTES) return NextResponse.json({ error: `File is over ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB.` }, { status: 413 });
  const parsed = parseCsv(csv);
  if (!parsed.headers.length || !parsed.rows.length) return NextResponse.json({ error: "No data rows found." }, { status: 400 });
  const service = createSupabaseServiceClient();

  if (body.action === "preview") {
    const mapping = body.mapping && Object.keys(body.mapping).length ? body.mapping : suggestLeadMapping(parsed.headers);
    const problem = validateLeadMapping(mapping);
    const { rows, issues } = buildLeadRows(parsed, mapping);
    const existing = await loadExisting(service);
    const { groups } = findDuplicates(rows, existing);
    return NextResponse.json({
      ok: true, headers: parsed.headers, mapping, mappingProblem: problem, totalRows: parsed.rows.length, truncated: parsed.truncated,
      preview: rows.slice(0, 10), issues, validCount: rows.length,
      duplicates: groups.map((g) => ({ key: g.key, why: g.why, rows: g.rows.map((r) => ({ row: r.row, business_name: r.business_name, city: r.city, phone: r.phone })), existing: g.existing })),
      groupValues: Array.from(new Set(rows.map((r) => r.group).filter(Boolean))) as string[],
      customColumns: parsed.headers.filter((h) => mapping[h] === "custom"),
    });
  }

  if (body.action !== "commit") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const mapping = body.mapping ?? {}; const problem = validateLeadMapping(mapping); if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const o = body.options ?? {};
  const opts: Options = { tags: Array.isArray(o.tags) ? o.tags.map(String) : [], rangeTags: o.rangeTags && o.rangeTags.lastN > 0 ? { lastN: Number(o.rangeTags.lastN), tags: (o.rangeTags.tags ?? []).map(String) } : null, stage: STAGES.includes(String(o.stage)) ? String(o.stage) : "new", assignment: o.assignment && o.assignment.column ? { column: String(o.assignment.column), map: Object.fromEntries(Object.entries(o.assignment.map ?? {}).map(([k, v]) => [k, String(v)])) } : null, decisions: (o.decisions ?? {}) as Record<string, "merge" | "skip">, filename: String(o.filename ?? "upload.csv").slice(0, 200), savePrefs: o.savePrefs !== false };
  // Assignee ids must be real team members — never trust the client's ids blindly.
  if (opts.assignment) { const { data: team } = await service.from("users").select("id").not("team_role", "is", null); const ok = new Set((team ?? []).map((t) => t.id as string)); for (const [k, v] of Object.entries(opts.assignment.map)) if (!ok.has(v)) delete opts.assignment.map[k]; }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder(); const send = (d: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(d)}\n\n`));
      try {
        const { rows, issues } = buildLeadRows(parsed, mapping);
        const existing = await loadExisting(service);
        const { groups, singles } = findDuplicates(rows, existing);
        const outcome: ImportOutcome = emptyOutcome(parsed.rows.length);
        const total = parsed.rows.length; const REASON: Record<string, string> = { missing_name: "Business name is blank", missing_phone: "Phone is blank", invalid_phone: "Phone is not a valid 10-digit US number", invalid_email: "Email is not valid" };
        for (const i of issues) { outcome.errored++; outcome.lines.push({ row: i.row, name: i.name, status: "error", reason: REASON[i.reason] }); }
        const { data: imp } = await service.from("crm_lead_imports").insert({ filename: opts.filename, row_count: total, mapping, options: { ...opts, decisions: undefined }, created_by: me.id, created_by_label: me.full_name || me.email }).select("id").single();
        const importId = imp?.id as string;
        type Planned = { lead: LeadRow; mergedFrom: number[] };
        const planned: Planned[] = singles.map((r) => ({ lead: r, mergedFrom: [] }));
        const updates: { id: string; lead: LeadRow; rows: number[] }[] = [];
        for (const g of groups) {
          const decision = opts.decisions[g.key] ?? "merge";
          if (decision === "skip") { for (const r of g.rows) { outcome.skipped++; outcome.lines.push({ row: r.row, name: r.business_name, status: "skipped", reason: `Duplicate (${g.why.join(" + ")})${g.existing.length ? ` of existing lead ${g.existing[0].business_name ?? g.existing[0].id}` : ""} — skipped by choice` }); } continue; }
          const merged = g.rows.length > 1 ? mergeRows(g.rows) : g.rows[0];
          if (g.existing.length) { updates.push({ id: g.existing[0].id, lead: merged, rows: g.rows.map((r) => r.row) }); }
          else planned.push({ lead: merged, mergedFrom: g.rows.slice(1).map((r) => r.row) });
        }
        let done = 0; const tick = () => { if (++done % 25 === 0 || done === total) send({ type: "progress", done, total }); };
        // Inserts in chunks of 100.
        for (let i = 0; i < planned.length; i += 100) {
          const chunk = planned.slice(i, i + 100);
          const payload = chunk.map(({ lead }) => { const rep = assigneeFor(lead, opts.assignment); if (opts.assignment && !rep) outcome.unassigned++; return { business_name: lead.business_name, website: lead.website, city: lead.city, state: lead.state, phone: lead.phone_raw, phone_normalized: lead.phone, email: lead.email, notes: lead.notes, tags: tagsFor(lead, opts.tags, opts.rangeTags, total), group_key: lead.group, custom_fields: lead.custom, pipeline_stage: opts.stage, assigned_rep: rep, created_by: me.id, source_type: "csv_import", import_id: importId }; });
          const { error } = await service.from("crm_leads").insert(payload);
          for (const p of chunk) {
            if (error) { outcome.errored++; outcome.lines.push({ row: p.lead.row, name: p.lead.business_name, status: "error", reason: `Database refused the row: ${error.message}` }); }
            else { outcome.imported++; for (const r of p.mergedFrom) { outcome.merged_in_file++; outcome.lines.push({ row: r, name: p.lead.business_name, status: "merged_in_file", reason: `Merged into row ${p.lead.row} (same ${p.lead.phone ? "phone/name" : "name"})` }); } }
            tick(); for (let k = 0; k < p.mergedFrom.length; k++) tick();
          }
        }
        // Merges into existing leads: fill blanks, union tags, append notes.
        for (const u of updates) {
          const { data: cur } = await service.from("crm_leads").select("website, city, state, email, notes, tags, custom_fields, group_key, assigned_rep").eq("id", u.id).maybeSingle();
          if (!cur) { for (const r of u.rows) { outcome.errored++; outcome.lines.push({ row: r, name: u.lead.business_name, status: "error", reason: "Existing lead vanished during import" }); tick(); } continue; }
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), phone_normalized: u.lead.phone, phone: cur.email === undefined ? undefined : undefined };
          for (const k of ["website", "city", "state", "email", "group_key"] as const) { const v = k === "group_key" ? u.lead.group : u.lead[k]; if (!cur[k] && v) patch[k] = v; }
          if (u.lead.notes && !(cur.notes ?? "").includes(u.lead.notes)) patch.notes = [cur.notes, u.lead.notes].filter(Boolean).join(" | ");
          patch.tags = Array.from(new Set([...(cur.tags ?? []), ...tagsFor(u.lead, opts.tags, opts.rangeTags, total)]));
          patch.custom_fields = { ...(cur.custom_fields ?? {}), ...u.lead.custom };
          if (!cur.assigned_rep) { const rep = assigneeFor(u.lead, opts.assignment); if (rep) patch.assigned_rep = rep; }
          delete patch.phone;
          const { error } = await service.from("crm_leads").update(patch).eq("id", u.id);
          for (const r of u.rows) { if (error) { outcome.errored++; outcome.lines.push({ row: r, name: u.lead.business_name, status: "error", reason: `Could not merge into existing lead: ${error.message}` }); } else { outcome.merged_existing++; outcome.lines.push({ row: r, name: u.lead.business_name, status: "merged_existing", reason: `Merged into existing lead ${u.id.slice(0, 8)} (blank fields filled, tags added)` }); } tick(); }
        }
        if (done < total) send({ type: "progress", done: total, total });
        outcome.lines.sort((a, b) => a.row - b.row);
        await service.from("crm_lead_imports").update({ imported: outcome.imported, merged_in_file: outcome.merged_in_file, merged_existing: outcome.merged_existing, skipped: outcome.skipped, errored: outcome.errored, report: outcome.lines, finished_at: new Date().toISOString() }).eq("id", importId);
        if (opts.savePrefs) await service.from("crm_lead_import_prefs").upsert({ user_id: me.id, mapping, options: { tags: opts.tags, stage: opts.stage, assignment: opts.assignment, rangeTags: opts.rangeTags }, updated_at: new Date().toISOString() });
        send({ type: "done", importId, outcome });
      } catch (e) { send({ type: "error", error: e instanceof Error ? e.message : "Import failed." }); }
      finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
