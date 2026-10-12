import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { customerBusiness, loadOnboarding, confirmStep, saveStepData } from "@/lib/onboarding/state";
import { parseProfileInput, extractBrandColors, stepByNo } from "@/lib/onboarding/flow";
import { fetchSite } from "@/lib/analyzer/checks";
import { resolveLogo } from "@/lib/analyzer/identity";
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

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
