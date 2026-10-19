import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OAUTH_PROVIDERS, buildAuthorizeUrl, isOAuthProviderKey, oauthConfigured } from "@/lib/integrations/providers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getClearance } from "@/lib/google/clearance";
import { canStartGoogleOAuth, CUSTOMER_WAITING_COPY } from "@/lib/google/gate";

export const runtime = "nodejs";

/** Starts the OAuth handshake for the signed-in user (team member or customer), own account only. */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const ret = req.nextUrl.searchParams.get("return"); // onboarding | dashboard | (team)
  const customerPath = ret === "onboarding" ? `/dashboard/onboarding/${params.provider === "gmail" ? "gmail" : "integrations"}` : "/dashboard/integrations";
  const back = new URL(ret === "dashboard" || ret === "onboarding" ? customerPath : "/team/integrations", req.url);
  if (!isOAuthProviderKey(params.provider)) { back.searchParams.set("error", "Unknown integration."); return NextResponse.redirect(back); }
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(ret === "dashboard" || ret === "onboarding" ? `/login?next=${encodeURIComponent(customerPath)}` : "/team/login", req.url));
  const p = OAUTH_PROVIDERS[params.provider];
  // Google testing-mode gate (2026-10-12): a CUSTOMER may start the Gmail handshake only once the team cleared their
  // address on Google's tester list — otherwise Google would show "Access blocked". Team members are never gated.
  if (p.key === "gmail" && (ret === "dashboard" || ret === "onboarding")) {
    const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).maybeSingle();
    if (!me?.team_role) {
      const service = createSupabaseServiceClient();
      const { data: biz } = await service.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const c = biz ? await getClearance(service, biz.id) : null;
      if (!canStartGoogleOAuth(c?.status, false)) { back.searchParams.set("error", CUSTOMER_WAITING_COPY); return NextResponse.redirect(back); }
    }
  }
  if (!oauthConfigured(p)) { back.searchParams.set("error", `${p.name} isn't configured yet: add ${p.env.clientId} and ${p.env.clientSecret} in Vercel.`); return NextResponse.redirect(back); }
  // Diagnostics (2026-10-19): ?debug=1 shows the exact authorize URL instead of redirecting — team owners only.
  // Contains only public values (client_id, redirect_uri, scopes); never the secret; state is a placeholder.
  if (req.nextUrl.searchParams.get("debug") === "1") {
    const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).maybeSingle();
    if (me?.team_role !== "owner") return NextResponse.json({ error: "Owner only." }, { status: 403 });
    const url = new URL(buildAuthorizeUrl(p, "DEBUG_STATE"));
    return NextResponse.json({ provider: p.key, authorize_url: url.toString(), client_id: url.searchParams.get(p.clientIdParam ?? "client_id"), redirect_uri: url.searchParams.get("redirect_uri"), redirect_host: new URL(url.searchParams.get("redirect_uri") ?? "https://x").host, scope: url.searchParams.get("scope"), app_url_env: process.env.NEXT_PUBLIC_APP_URL ?? null, request_host: req.headers.get("host") });
  }
  const fromDashboard = ret === "dashboard" || ret === "onboarding";
  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(p, state));
  res.cookies.set(`oauth_state_${p.key}`, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  res.cookies.set(`oauth_return_${p.key}`, ret === "onboarding" ? "onboarding" : fromDashboard ? "dashboard" : "team", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
