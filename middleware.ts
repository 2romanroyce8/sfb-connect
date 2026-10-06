import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE, hardenCookie, shouldPersist } from "@/lib/supabase/sessionPolicy";
import { AGENT_SESSION_COOKIE, isMutatingMethod } from "@/lib/agent/readOnly";

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
          response.cookies.set(name, value, hardenCookie(options, request.nextUrl.protocol === "https:", persist));
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

  // ---- Delegated agent browser sessions ----------------------------------
  // A browser opened through an agent handoff carries `sfb_agent` (the
  // authorization id). Every request re-checks that the authorization is
  // still active -- revoking in Settings kills the browser on its next
  // request -- and every mutating request is refused: agent sessions are
  // read-only regardless of the user's own role.
  const agentAuthorizationId = request.cookies.get(AGENT_SESSION_COOKIE)?.value;
  if (agentAuthorizationId) {
    const active = await agentAuthorizationActive(agentAuthorizationId, user?.id ?? null);
    if (!active) {
      const url = request.nextUrl.clone();
      url.pathname = "/team/login";
      url.search = "";
      url.searchParams.set("error", "agent_revoked");
      const out = path.startsWith("/api/") ? NextResponse.json({ error: "agent_revoked", message: "This agent authorization has been revoked." }, { status: 401 }) : NextResponse.redirect(url);
      for (const c of request.cookies.getAll()) out.cookies.set(c.name, "", { path: "/", maxAge: 0 });
      return out;
    }
    if (isMutatingMethod(request.method)) {
      return NextResponse.json({ error: "read_only_agent_session", message: "Delegated agent sessions are read-only. Writes require the user's own login." }, { status: 403 });
    }
    response.headers.set("x-sfb-agent-session", "read-only");
  }
  if (path.startsWith("/api/")) return response;

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

/** Edge-safe check (plain REST, service role) -- no node-only crypto here. */
async function agentAuthorizationActive(id: string, userId: string | null): Promise<boolean> {
  if (!userId || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/agent_authorizations?id=eq.${id}&select=status,user_id,scopes`, {
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as { status: string; user_id: string; scopes: string[] }[];
    const row = rows[0];
    return !!row && row.status === "active" && row.user_id === userId && row.scopes.includes("sfb:browser");
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding/:path*", "/team/:path*", "/api/team/:path*", "/api/crm/:path*"],
};
