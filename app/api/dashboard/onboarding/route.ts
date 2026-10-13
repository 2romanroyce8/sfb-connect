import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { customerBusinessOrReason, loadOnboarding, confirmStep, saveStepData } from "@/lib/onboarding/state";
import { parseProfileInput, extractBrandColors, stepByNo } from "@/lib/onboarding/flow";
import { fetchSite } from "@/lib/analyzer/checks";
import { resolveLogo } from "@/lib/analyzer/identity";
import { parseIcpInput, defaultIcp, type Icp } from "@/lib/onboarding/icp";
import { sourceCandidates, acceptCandidates, type LeadCandidate } from "@/lib/onboarding/leads";
import { previewCsv, importProspects } from "@/lib/outbound/importProspects";
import type { ImportField } from "@/lib/outbound/csvImport";
import { activateSequence, previewSequence, cadence, type CadenceKey } from "@/lib/onboarding/automations";
import { startDfyCheckout } from "@/lib/billing/dfy";
import { campaignStatus, launchCampaign, approveCampaign, rejectCampaignMessage } from "@/lib/onboarding/campaignRun";
import { listLibrary, pickIntro, saveTemplate, archiveTemplate, resolveSource, senderVarsFor, sampleProspect } from "@/lib/outbound/library";
import { renderSource } from "@/lib/outbound/templates";
import { assistEdit, assistConfigured, ASSIST_INSTRUCTIONS, type AssistKey } from "@/lib/outbound/assist";
import { OutboundError } from "@/lib/outbound/errors";
import { appOrigin } from "@/lib/agent/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in customer's onboarding state (derived from real stored state) + profile + saved inputs. */
export async function GET() {
  const whoOr = await customerBusinessOrReason(createSupabaseServerClient());
  if (!("businessId" in whoOr)) return NextResponse.json({ error: whoOr.reason === "signed_out" ? "You\u2019re signed out \u2014 sign in again and retry." : "No active membership." }, { status: whoOr.reason === "signed_out" ? 401 : 403 });
  const who = whoOr;
  const out = await loadOnboarding(createSupabaseServiceClient(), who.businessId);
  return NextResponse.json(out);
}

/**
 * action=save        {step, data}   — draft inputs, saved as typed (resume lands with them intact)
 * action=confirm     {step, data?}  — explicit completion for steps with no derivable state; step 1 also writes the profile
 * action=dismiss                    — "take me to the dashboard" (only once the hard gates are passed)
 * action=brand_pull                 — re-read the website for logo + colors
 * action=brand_colors {colors}      — set colors by hand
 */
export async function POST(req: NextRequest) {
  const whoOr = await customerBusinessOrReason(createSupabaseServerClient());
  if (!("businessId" in whoOr)) return NextResponse.json({ error: whoOr.reason === "signed_out" ? "You\u2019re signed out \u2014 sign in again and retry." : "No active membership." }, { status: whoOr.reason === "signed_out" ? 401 : 403 });
  const who = whoOr;
  const service = createSupabaseServiceClient();
  const body = (await req.json().catch(() => ({}))) as { action?: string; step?: number; data?: Record<string, unknown>; colors?: unknown };
  const step = Number(body.step);

  if (body.action === "save") {
    if (!stepByNo(step)) return NextResponse.json({ error: "Unknown step." }, { status: 400 });
    await saveStepData(service, who.businessId, step, body.data ?? {});
    return NextResponse.json({ ok: true });
  }

  if (body.action === "confirm") {
    const def = stepByNo(step); if (!def) return NextResponse.json({ error: "Unknown step." }, { status: 400 });
    const { state } = await loadOnboarding(service, who.businessId);
    const st = state.steps.find((s) => s.no === step)!;
    if (st.locked) return NextResponse.json({ error: st.lockReason }, { status: 409 });
    if (step === 1) {
      const parsed = parseProfileInput(body.data ?? {});
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const { error } = await service.from("businesses").update(parsed.patch).eq("id", who.businessId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (step === 2 || step === 3) return NextResponse.json({ error: "This step completes itself when the connection succeeds." }, { status: 400 });
    await confirmStep(service, who.businessId, step);
    const after = await loadOnboarding(service, who.businessId);
    return NextResponse.json({ ok: true, state: after.state });
  }

  if (body.action === "dismiss") {
    const { state } = await loadOnboarding(service, who.businessId);
    if (!state.gatesPassed) return NextResponse.json({ error: "Connect Gmail and Google Calendar first — your agent can't work without them." }, { status: 409 });
    await service.from("customer_onboarding").update({ dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("business_id", who.businessId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "brand_pull") {
    const { data: biz } = await service.from("businesses").select("website").eq("id", who.businessId).single();
    if (!biz?.website) return NextResponse.json({ error: "Add your website in step 1 first." }, { status: 400 });
    const site = await fetchSite(biz.website);
    if (!site.ok) return NextResponse.json({ error: `Couldn't read ${biz.website} (${site.status ?? "no response"}). Upload your logo instead.` }, { status: 502 });
    const logo = await resolveLogo(site.html, site.finalUrl);
    const colors = extractBrandColors(site.html);
    const patch: Record<string, unknown> = { brand_colors: colors, updated_at: new Date().toISOString() };
    if (logo.url) patch.brand_logo_url = logo.url;
    await service.from("businesses").update(patch).eq("id", who.businessId);
    return NextResponse.json({ ok: true, logoUrl: logo.url, logoSource: logo.source, colors, note: logo.url ? null : "No clean logo found on the site — upload one below." });
  }

  if (body.action === "brand_colors") {
    const colors = Array.isArray(body.colors) ? (body.colors as unknown[]).filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase()).slice(0, 4) : [];
    await service.from("businesses").update({ brand_colors: colors, updated_at: new Date().toISOString() }).eq("id", who.businessId);
    return NextResponse.json({ ok: true, colors });
  }

  // ---------- O2: steps 6–8 ----------
  if (body.action === "icp_suggest") {
    const { data: biz } = await service.from("businesses").select("primary_category, city, state, icp").eq("id", who.businessId).single();
    return NextResponse.json({ icp: (biz?.icp as Icp | null) ?? defaultIcp(biz!) });
  }

  if (body.action === "icp_save") {
    const parsed = parseIcpInput(body.data ?? {});
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { error } = await service.from("businesses").update({ icp: parsed.icp, updated_at: new Date().toISOString() }).eq("id", who.businessId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await confirmStep(service, who.businessId, 6);
    return NextResponse.json({ ok: true, icp: parsed.icp });
  }

  // Customer list upload (step 7 and later): preview → mapping → import. 0 credits.
  if (body.action === "leads_import_preview") {
    const r = previewCsv(typeof body.data?.csv === "string" ? body.data.csv : "");
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, preview: r });
  }
  if (body.action === "leads_import_commit") {
    const { data: { user } } = await createSupabaseServerClient().auth.getUser();
    const mapping = (body.data?.mapping && typeof body.data.mapping === "object" ? body.data.mapping : {}) as Record<string, ImportField>;
    const r = await importProspects(service, { businessId: who.businessId, filename: typeof body.data?.filename === "string" ? body.data.filename : "upload.csv", csv: typeof body.data?.csv === "string" ? body.data.csv : "", mapping }, { kind: "user", id: who.userId, label: user?.email ?? "customer" });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const { row } = await loadOnboarding(service, who.businessId);
    const d = (row.step_data?.["7"] as Record<string, unknown> | undefined) ?? {};
    const imports = Array.isArray(d.imports) ? (d.imports as unknown[]).slice(-9) : [];
    await saveStepData(service, who.businessId, 7, { ...d, imports: [...imports, { id: r.importId, filename: typeof body.data?.filename === "string" ? body.data.filename : "upload.csv", at: new Date().toISOString(), imported: r.report.imported, skipped: r.report.skipped }] });
    if (r.report.imported > 0) await confirmStep(service, who.businessId, 7);
    return NextResponse.json({ ok: true, importId: r.importId, report: r.report });
  }

  if (body.action === "leads_source") {
    const { data: biz } = await service.from("businesses").select("id, website, icp").eq("id", who.businessId).single();
    if (!biz?.icp) return NextResponse.json({ error: "Set your ideal customer (step 6) first." }, { status: 409 });
    const { row: onb } = await loadOnboarding(service, who.businessId);
    const prev = (onb.step_data?.["7"] as { excluded?: string[]; imports?: unknown[] } | undefined) ?? {};
    const r = await sourceCandidates(service, { id: biz.id, website: biz.website }, biz.icp as Icp, { limit: 25, excludeDomains: prev.excluded ?? [] });
    if (r.error) return NextResponse.json({ error: r.error }, { status: 503 });
    await saveStepData(service, who.businessId, 7, { ...prev, candidates: r.candidates, queries: r.queries, sourcedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, candidates: r.candidates, queries: r.queries });
  }

  if (body.action === "leads_remove") {
    const id = typeof body.data?.id === "string" ? body.data.id : null;
    const { row } = await loadOnboarding(service, who.businessId);
    const d = (row.step_data?.["7"] as { candidates?: LeadCandidate[]; excluded?: string[] } | undefined) ?? {};
    const removed = (d.candidates ?? []).find((c) => c.id === id);
    const candidates = (d.candidates ?? []).filter((c) => c.id !== id);
    // Remember what the customer removed so the next search never re-offers it (G2). Capped at 500 domains.
    const excluded = Array.from(new Set([...(d.excluded ?? []), ...(removed ? [removed.domain] : [])])).slice(-500);
    await saveStepData(service, who.businessId, 7, { ...d, candidates, excluded });
    return NextResponse.json({ ok: true, candidates });
  }

  if (body.action === "leads_accept") {
    const { row } = await loadOnboarding(service, who.businessId);
    const d = (row.step_data?.["7"] as { candidates?: LeadCandidate[] } | undefined) ?? {};
    const ids = Array.isArray(body.data?.ids) ? new Set((body.data!.ids as unknown[]).filter((x): x is string => typeof x === "string")) : null;
    const chosen = (d.candidates ?? []).filter((c) => !ids || ids.has(c.id));
    if (!chosen.length) return NextResponse.json({ error: "Keep at least one business on the list, or run the search again." }, { status: 400 });
    const { data: { user } } = await createSupabaseServerClient().auth.getUser();
    const results = await acceptCandidates(service, who.businessId, chosen, { id: who.userId, label: user?.email ?? "customer" });
    await saveStepData(service, who.businessId, 7, { ...d, candidates: [], acceptedAt: new Date().toISOString(), accepted: results.filter((r) => r.status === "added").length });
    await confirmStep(service, who.businessId, 7);
    return NextResponse.json({ ok: true, results });
  }

  if (body.action === "automations_preview") {
    const { data: biz } = await service.from("businesses").select("legal_name, primary_category, outbound_offer_line, city, icp, owner_id").eq("id", who.businessId).single();
    const { data: owner } = await service.from("users").select("full_name, email").eq("id", biz!.owner_id).maybeSingle();
    const key = cadence(typeof body.data?.cadence === "string" ? body.data.cadence : null).key;
    const icp = biz!.icp as Icp | null;
    try {
      const preview = previewSequence(cadence(key).steps, { name: (owner?.full_name as string) || (owner?.email as string) || biz!.legal_name, company: biz!.legal_name, category: biz!.primary_category, offerLine: biz!.outbound_offer_line }, { company: "Example Co.", city: icp?.locations?.[0]?.split(",")[0] ?? biz!.city, category: icp?.industries?.[0] ?? null });
      return NextResponse.json({ ok: true, cadence: key, preview });
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Preview failed.", fix: "/dashboard/onboarding/profile" }, { status: 409 }); }
  }

  if (body.action === "automations_activate") {
    const key = cadence(typeof body.data?.cadence === "string" ? body.data.cadence : null).key as CadenceKey;
    const { data: biz } = await service.from("businesses").select("outbound_offer_line").eq("id", who.businessId).single();
    if (!biz?.outbound_offer_line) return NextResponse.json({ error: "Add your one-line offer in step 1 first — every intro uses it.", fix: "/dashboard/onboarding/profile" }, { status: 409 });
    const id = await activateSequence(service, who.businessId, key);
    await confirmStep(service, who.businessId, 8);
    return NextResponse.json({ ok: true, sequenceId: id, cadence: key });
  }

  // ---------- O3: steps 9–11 ----------
  const bizFull = async () => { const { data } = await service.from("businesses").select("id, legal_name, owner_id, stripe_customer_id").eq("id", who.businessId).single(); return data!; };
  const meLabel = async () => { const { data: { user } } = await createSupabaseServerClient().auth.getUser(); return { id: who.userId, label: user?.email ?? "customer" }; };

  if (body.action === "dfy_choose") {
    const choice = body.data?.choice;
    if (choice !== "self_serve" && choice !== "retainer_talk") return NextResponse.json({ error: "Unknown choice." }, { status: 400 });
    const { row } = await loadOnboarding(service, who.businessId);
    if (row.dfy_choice === "install") return NextResponse.json({ ok: true, choice: "install" }); // paid install wins; never downgrade
    // retainer_talk only counts once a demo call was actually booked by this customer (the popup reports its id); never trust the id blindly.
    let demoCallId: string | null = null;
    if (choice === "retainer_talk") {
      const id = typeof body.data?.demo_call_id === "string" ? body.data.demo_call_id : "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Book the call first — the popup advances you once the booking is saved." }, { status: 400 });
      const { data: call } = await service.from("demo_calls").select("id, status").eq("id", id).eq("signup_user_id", who.userId).maybeSingle();
      if (!call || call.status === "canceled") return NextResponse.json({ error: "We couldn't find that booking on your account." }, { status: 404 });
      demoCallId = call.id as string;
    }
    await service.from("customer_onboarding").update({ dfy_choice: choice, dfy_chosen_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("business_id", who.businessId);
    if (demoCallId) await saveStepData(service, who.businessId, 9, { demo_call_id: demoCallId, booked_at: new Date().toISOString() });
    await confirmStep(service, who.businessId, 9);
    return NextResponse.json({ ok: true, choice, demoCallId });
  }
  if (body.action === "dfy_checkout") {
    try {
      const b = await bizFull(); const me = await meLabel();
      const { checkoutUrl } = await startDfyCheckout(service, b, { id: me.id, email: me.label }, appOrigin(req));
      return NextResponse.json({ ok: true, checkoutUrl });
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed." }, { status: 502 }); }
  }
  if (body.action === "campaign_status") return NextResponse.json({ ok: true, status: await campaignStatus(service, await bizFull()) });
  // ---------- Template library + custom emails (2026-10-12) ----------
  if (body.action === "template_library") return NextResponse.json({ ok: true, library: await listLibrary(service, who.businessId), assist: { configured: assistConfigured(), instructions: ASSIST_INSTRUCTIONS } });
  if (body.action === "template_pick") {
    const key = typeof body.data?.key === "string" && body.data.key ? body.data.key : null;
    try { await pickIntro(service, who.businessId, key); return NextResponse.json({ ok: true, key }); }
    catch (e) { if (e instanceof OutboundError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status }); throw e; }
  }
  if (body.action === "template_preview") {
    try {
      const src = await resolveSource(service, who.businessId, typeof body.data?.key === "string" ? body.data.key : "custom", body.data?.custom as { subject: string; body: string } | undefined);
      const [sender, sample] = await Promise.all([senderVarsFor(service, who.businessId), sampleProspect(service, who.businessId)]);
      const rendered = renderSource(src, { company: sample.company, contact_name: sample.contact_name, city: sample.city, category: sample.category, sender_name: sender.sender_name, sender_company: sender.sender_company, sender_category: sender.sender_category, offer_line: sender.offer_line });
      return NextResponse.json({ ok: true, preview: rendered, sample });
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Can't preview." }, { status: e instanceof OutboundError ? e.status : 400 }); }
  }
  if (body.action === "template_assist") {
    const d = body.data ?? {}; const draft = { subject: String(d.subject ?? ""), body: String(d.body ?? "") };
    const ins = ASSIST_INSTRUCTIONS.some((i) => i.key === d.instruction) ? (d.instruction as AssistKey) : "shorter";
    try { return NextResponse.json({ ok: true, edited: await assistEdit(draft, ins) }); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Editing help failed." }, { status: assistConfigured() ? 502 : 503 }); }
  }
  if (body.action === "template_save") {
    const { data: { user } } = await createSupabaseServerClient().auth.getUser();
    try { const t = await saveTemplate(service, who.businessId, { name: String(body.data?.name ?? ""), messageId: typeof body.data?.message_id === "string" ? body.data.message_id : null, subject: typeof body.data?.subject === "string" ? body.data.subject : undefined, body: typeof body.data?.body === "string" ? body.data.body : undefined, category: body.data?.category === "saved" ? "saved" : "custom" }, { label: user?.email ?? "customer" }); return NextResponse.json({ ok: true, template: t }); }
    catch (e) { if (e instanceof OutboundError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status }); throw e; }
  }
  if (body.action === "template_archive") { if (typeof body.data?.id === "string") await archiveTemplate(service, who.businessId, body.data.id); return NextResponse.json({ ok: true }); }

  if (body.action === "campaign_launch") {
    const r = await launchCampaign(service, await bizFull(), await meLabel(), typeof body.data?.template === "string" && body.data.template ? { template: body.data.template, custom: (body.data.custom as { subject: string; body: string } | undefined) ?? null } : null);
    return NextResponse.json({ ok: true, ...r });
  }
  if (body.action === "campaign_approve") {
    const ids = body.data?.ids === "all" ? "all" : Array.isArray(body.data?.ids) ? (body.data!.ids as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : [];
    if (ids !== "all" && !ids.length) return NextResponse.json({ error: "Pick a draft to approve." }, { status: 400 });
    const r = await approveCampaign(service, await bizFull(), await meLabel(), ids);
    return NextResponse.json({ ok: true, ...r });
  }
  if (body.action === "campaign_reject") {
    const id = typeof body.data?.id === "string" ? body.data.id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required." }, { status: 400 });
    await rejectCampaignMessage(service, id, await meLabel(), typeof body.data?.reason === "string" ? body.data.reason : "");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
