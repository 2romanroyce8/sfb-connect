import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE, applyPersistence, shouldPersist } from "@/lib/supabase/sessionPolicy";

/**
 * Protects /dashboard/** for any authenticated user, /admin/** for
 * users.role = 'admin', and /team/** for provisioned team members.
 *
 * Session durability (the "signed out again" bug): Supabase rotates the
 * refresh token on every refresh. If a request triggers a rotation and the
 * response that carries the NEW token is discarded -- which the previous
 * version did on every redirect -- the browser keeps presenting the OLD,
 * now-revoked token, and the whole session is terminated. Every response
 * built here therefore carries the refreshed cookies, redirects included.
 */
export async function middleware(request: NextRequest) {
  const persist = shouldPersist(request.cookies.get(REMEMBER_COOKIE)?.value);
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update the request so downstream Server Components see the fresh
        // token, then rebuild the response and write the cookies to it.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options.maxAge === 0 ? options : applyPersistence(options, persist));
        }
      },
    },
  });

  // Carries any refreshed auth cookies onto a redirect response.
  const redirectWithCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const needsAuth = path.startsWith("/dashboard") || path.startsWith("/admin") || path.startsWith("/onboarding");
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return redirectWithCookies(url);
  }

  if (path.startsWith("/admin") && user) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return redirectWithCookies(url);
    }
  }

  // SFB Sales OS -- internal team CRM. /team/login, /team/forgot-password and
  // /team/reset-password are the only public routes in this tree; the latter
  // two must be reachable while logged OUT or password recovery is impossible.
  const TEAM_PUBLIC = ["/team/login", "/team/forgot-password", "/team/reset-password"];
  if (path.startsWith("/team") && !TEAM_PUBLIC.includes(path)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/team/login";
      url.searchParams.set("next", path);
      return redirectWithCookies(url);
    }
    const { data: profile } = await supabase.from("users").select("team_role, team_status").eq("id", user.id).single();
    if (!profile?.team_role || profile.team_status === "disabled") {
      const url = request.nextUrl.clone();
      url.pathname = "/team/login";
      url.searchParams.set("error", "not_authorized");
      return redirectWithCookies(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding/:path*", "/team/:path*"],
};
