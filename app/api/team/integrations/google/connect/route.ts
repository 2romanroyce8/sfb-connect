import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl } from "@/lib/crm/googleCalendar";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getClearance } from "@/lib/google/clearance";
import { canStartGoogleOAuth, CUSTOMER_WAITING_COPY } from "@/lib/google/gate";

// Kicks off the OAuth handshake for the CURRENTLY logged-in rep only — each
// team member connects their own calendar from their own session. There is
// no way to connect on someone else's behalf here.
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ret = req.nextUrl.searchParams.get("return"); // onboarding | dashboard | (team)
  if (!user) return NextResponse.redirect(new URL(ret ? `/login?next=${encodeURIComponent(ret === "onboarding" ? "/dashboard/onboarding/calendar" : "/dashboard/integrations")}` : "/team/login", req.url));

  // Google testing-mode gate (2026-10-12): customers only once cleared; team members never gated.
  if (ret === "onboarding" || ret === "dashboard") {
    const { data: me } = await supabase.from("users").select("team_role").eq("id", user.id).maybeSingle();
    if (!me?.team_role) {
      const service = createSupabaseServiceClient();
      const { data: biz } = await service.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const c = biz ? await getClearance(service, biz.id) : null;
      if (!canStartGoogleOAuth(c?.status, false)) { const back = new URL(ret === "onboarding" ? "/dashboard/onboarding/calendar" : "/dashboard/integrations", req.url); back.searchParams.set("error", CUSTOMER_WAITING_COPY); return NextResponse.redirect(back); }
    }
  }

  let authUrl: string;
  try {
    const state = crypto.randomBytes(24).toString("hex");
    authUrl = buildGoogleAuthUrl(state);
    const res = NextResponse.redirect(authUrl);
    res.cookies.set("google_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    res.cookies.set("google_oauth_return", ret === "onboarding" || ret === "dashboard" ? ret : "team", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return res;
  } catch (err) {
    const url = new URL("/team/integrations", req.url);
    url.searchParams.set("error", err instanceof Error ? err.message : "Google OAuth isn't configured yet.");
    return NextResponse.redirect(url);
  }
}
