import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { connectGoogleCalendar } from "@/lib/crm/googleCalendar";

export async function GET(req: NextRequest) {
  const url = new URL("/team/integrations", req.url);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;
  const googleError = req.nextUrl.searchParams.get("error");

  if (googleError) {
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
  if (!user) return NextResponse.redirect(new URL("/team/login", req.url));

  try {
    const { email } = await connectGoogleCalendar(user.id, code);
    url.searchParams.set("connected", email);
  } catch (err) {
    url.searchParams.set("error", err instanceof Error ? err.message : "Could not connect Google Calendar.");
  }

  const res = NextResponse.redirect(url);
  res.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
  return res;
}
