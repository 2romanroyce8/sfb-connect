import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { connectGoogleCalendar } from "@/lib/crm/googleCalendar";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAccessDenied, markConnected } from "@/lib/google/clearance";
import { appOrigin } from "@/lib/agent/auth";
import { GET as genericCallback } from "@/app/api/team/integrations/[provider]/callback/route";

export async function GET(req: NextRequest) {
  // Gmail shares this registered redirect URI with Calendar. Its handshake is
  // identified by its own state cookie; hand it to the generic OAuth handler.
  const st = req.nextUrl.searchParams.get("state");
  if (st && req.cookies.get("oauth_state_gmail")?.value === st) return genericCallback(req, { params: { provider: "gmail" } });
  const ret = req.cookies.get("google_oauth_return")?.value;
  const url = new URL(ret === "onboarding" ? "/dashboard/onboarding/calendar" : ret === "dashboard" ? "/dashboard/integrations" : "/team/integrations", req.url);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;
  const googleError = req.nextUrl.searchParams.get("error");

  if (googleError) {
    let customer = ret === "onboarding" || ret === "dashboard";
    if (!customer) { // cookies expired (>10 min on Google's page)? a signed-in non-team user is still a customer
      const { data: { user: u } } = await createSupabaseServerClient().auth.getUser();
      if (u) { const { data: me } = await createSupabaseServiceClient().from("users").select("team_role").eq("id", u.id).maybeSingle(); customer = !me?.team_role; }
    }
    if (googleError === "access_denied" && customer) {
      // Backstop (2026-10-12): a customer reached Google's consent screen before being cleared. Never show Google's text;
      // log + alert the team, send them to the friendly holding page.
      const { data: { user: denied } } = await createSupabaseServerClient().auth.getUser();
      await recordAccessDenied(createSupabaseServiceClient(), denied?.id ?? null, appOrigin(req));
      const res = NextResponse.redirect(new URL("/dashboard/google-not-cleared", req.url)); res.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" }); res.cookies.set("google_oauth_return", "", { maxAge: 0, path: "/" }); return res;
    }
    url.searchParams.set("error", googleError === "access_denied" ? "Google connection was cancelled." : googleError);
    return NextResponse.redirect(url);
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    url.searchParams.set("error", "Google sign-in couldn't be verified — please try connecting again.");
    return NextResponse.redirect(url);
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(ret ? `/login?next=${encodeURIComponent(url.pathname)}` : "/team/login", req.url));

  try {
    const { email } = await connectGoogleCalendar(user.id, code);
    url.searchParams.set("connected", email);
    if (ret === "onboarding" || ret === "dashboard") await markConnected(createSupabaseServiceClient(), user.id, email).catch(() => undefined);
  } catch (err) {
    url.searchParams.set("error", err instanceof Error ? err.message : "Could not connect Google Calendar.");
  }

  const res = NextResponse.redirect(url);
  res.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
  res.cookies.set("google_oauth_return", "", { maxAge: 0, path: "/" });
  return res;
}
