import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OAUTH_PROVIDERS, buildAuthorizeUrl, isOAuthProviderKey, oauthConfigured } from "@/lib/integrations/providers";

export const runtime = "nodejs";

/** Starts the OAuth handshake for the signed-in user (team member or customer), own account only. */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const back = new URL(req.nextUrl.searchParams.get("return") === "dashboard" ? "/dashboard/integrations" : "/team/integrations", req.url);
  if (!isOAuthProviderKey(params.provider)) { back.searchParams.set("error", "Unknown integration."); return NextResponse.redirect(back); }
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(req.nextUrl.searchParams.get("return") === "dashboard" ? `/login?next=${encodeURIComponent("/dashboard/integrations")}` : "/team/login", req.url));
  const p = OAUTH_PROVIDERS[params.provider];
  if (!oauthConfigured(p)) { back.searchParams.set("error", `${p.name} isn't configured yet: add ${p.env.clientId} and ${p.env.clientSecret} in Vercel.`); return NextResponse.redirect(back); }
  // Customers connect from /dashboard; a trial (sandbox) business has no real integrations by design.
  const fromDashboard = req.nextUrl.searchParams.get("return") === "dashboard";
  if (fromDashboard) {
    const { data: biz } = await supabase.from("businesses").select("is_sandbox").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (biz?.is_sandbox) { const d = new URL("/dashboard/integrations", req.url); d.searchParams.set("error", "Integrations connect on Solo and Agency. The trial runs on demo data."); return NextResponse.redirect(d); }
  }
  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(p, state));
  res.cookies.set(`oauth_state_${p.key}`, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  res.cookies.set(`oauth_return_${p.key}`, fromDashboard ? "dashboard" : "team", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
