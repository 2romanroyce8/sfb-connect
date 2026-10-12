import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OAUTH_PROVIDERS, buildAuthorizeUrl, isOAuthProviderKey, oauthConfigured } from "@/lib/integrations/providers";

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
  if (!oauthConfigured(p)) { back.searchParams.set("error", `${p.name} isn't configured yet: add ${p.env.clientId} and ${p.env.clientSecret} in Vercel.`); return NextResponse.redirect(back); }
  const fromDashboard = ret === "dashboard" || ret === "onboarding";
  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(p, state));
  res.cookies.set(`oauth_state_${p.key}`, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  res.cookies.set(`oauth_return_${p.key}`, ret === "onboarding" ? "onboarding" : fromDashboard ? "dashboard" : "team", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
