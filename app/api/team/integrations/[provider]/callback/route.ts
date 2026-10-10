import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OAUTH_PROVIDERS, exchangeCode, isOAuthProviderKey } from "@/lib/integrations/providers";
import { saveConnection } from "@/lib/integrations/connections";

export const runtime = "nodejs";

/** OAuth return leg: verifies state, exchanges the code, stores tokens encrypted, marks the provider verified. */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const returnTo = req.cookies.get(`oauth_return_${params.provider}`)?.value === "dashboard" ? "/dashboard/integrations" : "/team/integrations";
  const back = new URL(returnTo, req.url);
  if (!isOAuthProviderKey(params.provider)) { back.searchParams.set("error", "Unknown integration."); return NextResponse.redirect(back); }
  const p = OAUTH_PROVIDERS[params.provider];
  const q = req.nextUrl.searchParams;
  const cookieName = `oauth_state_${p.key}`;
  const clear = (res: NextResponse) => { res.cookies.set(cookieName, "", { maxAge: 0, path: "/" }); res.cookies.set(`oauth_return_${p.key}`, "", { maxAge: 0, path: "/" }); return res; };

  if (q.get("error")) { back.searchParams.set("error", q.get("error") === "access_denied" ? `${p.name} connection was cancelled.` : `${p.name}: ${q.get("error_description") || q.get("error")}`); return clear(NextResponse.redirect(back)); }
  const code = q.get("code"), state = q.get("state"), cookieState = req.cookies.get(cookieName)?.value;
  if (!code || !state || !cookieState || state !== cookieState) { back.searchParams.set("error", `${p.name} sign-in couldn't be verified — please try connecting again.`); return clear(NextResponse.redirect(back)); }

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(returnTo.startsWith("/dashboard") ? "/login" : "/team/login", req.url));

  try {
    const token = await exchangeCode(p, code);
    const label = await p.accountLabel(token.raw).catch(() => null);
    // Provider-specific metadata worth keeping (never secrets): GHL location, Slack team/channel, Notion workspace.
    const meta: Record<string, unknown> = {};
    for (const k of ["locationId", "companyId", "team", "incoming_webhook", "workspace_id", "workspace_name", "bot_id", "scope"]) if (k in token.raw) meta[k] = token.raw[k];
    if (meta.incoming_webhook && typeof meta.incoming_webhook === "object") { const iw = meta.incoming_webhook as Record<string, unknown>; delete iw.url; } // the Slack webhook URL is a secret
    await saveConnection(p.key, user.id, token, label, meta);
    back.searchParams.set("connected", `${p.name}${label ? ` (${label})` : ""}`);
  } catch (err) {
    back.searchParams.set("error", err instanceof Error ? err.message : `Could not connect ${p.name}.`);
  }
  return clear(NextResponse.redirect(back));
}
