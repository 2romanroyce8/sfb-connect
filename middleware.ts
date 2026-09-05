import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Protects /dashboard/** for any authenticated user and /admin/** for users
 * whose public.users.role = 'admin'. Redirects unauthenticated visitors to
 * /login with a `next` param so they land back where they intended.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const needsAuth =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/onboarding");
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // SFB Sales OS — internal team CRM, entirely separate from the customer
  // portal above. /team/login is the only public route in this tree.
  if (path.startsWith("/team") && path !== "/team/login") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/team/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    const { data: profile } = await supabase
      .from("users")
      .select("team_role, team_status")
      .eq("id", user.id)
      .single();
    if (!profile?.team_role || profile.team_status === "disabled") {
      const url = request.nextUrl.clone();
      url.pathname = "/team/login";
      url.searchParams.set("error", "not_authorized");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding/:path*", "/team/:path*"],
};
