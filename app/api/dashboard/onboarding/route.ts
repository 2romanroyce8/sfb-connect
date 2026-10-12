import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { customerBusiness, loadOnboarding, confirmStep, saveStepData } from "@/lib/onboarding/state";
import { parseProfileInput, extractBrandColors, stepByNo } from "@/lib/onboarding/flow";
import { fetchSite } from "@/lib/analyzer/checks";
import { resolveLogo } from "@/lib/analyzer/identity";
import { parseIcpInput, defaultIcp, type Icp } from "@/lib/onboarding/icp";
import { sourceCandidates, acceptCandidates, type LeadCandidate } from "@/lib/onboarding/leads";
import { activateSequence, previewSequence, cadence, type CadenceKey } from "@/lib/onboarding/automations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in customer's onboarding state (derived from real stored state) + profile + saved inputs. */
export async function GET() {
  const who = await customerBusiness(createSupabaseServerClient());
  if (!who) return NextResponse.json({ error: "No active membership." }, { status: 403 });
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
  const who = await customerBusiness(createSupabaseServerClient());
  if (!who) return NextResponse.json({ error: "No active membership." }, { status: 403 });
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

  if (body.action === "leads_source") {
    const { data: biz } = await service.from("businesses").select("id, website, icp").eq("id", who.businessId).single();
    if (!biz?.icp) return NextResponse.json({ error: "Set your ideal customer (step 6) first." }, { status: 409 });
    const r = await sourceCandidates(service, { id: biz.id, website: biz.website }, biz.icp as Icp, { limit: 25 });
    if (r.error) return NextResponse.json({ error: r.error }, { status: 503 });
    await saveStepData(service, who.businessId, 7, { candidates: r.candidates, queries: r.queries, sourcedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, candidates: r.candidates, queries: r.queries });
  }

  if (body.action === "leads_remove") {
    const id = typeof body.data?.id === "string" ? body.data.id : null;
    const { row } = await loadOnboarding(service, who.businessId);
    const d = (row.step_data?.["7"] as { candidates?: LeadCandidate[] } | undefined) ?? {};
    const candidates = (d.candidates ?? []).filter((c) => c.id !== id);
    await saveStepData(service, who.businessId, 7, { ...d, candidates });
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

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
