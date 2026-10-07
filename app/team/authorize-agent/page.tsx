import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/agent/store";
import { redirectUriAllowed } from "@/lib/agent/oauth";
import { negotiateScopes, describeScope } from "@/lib/agent/scopes";
import { AGENT_SESSION_COOKIE } from "@/lib/agent/readOnly";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// OAuth consent screen. Lives behind the normal /team login (middleware), so
// the person deciding is a real, signed-in team member -- never the agent.
export default async function AuthorizeAgentPage({ searchParams }: { searchParams: Search }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/team/login?next=${encodeURIComponent(`/team/authorize-agent?${new URLSearchParams(Object.entries(searchParams).map(([k, v]) => [k, one(v)])).toString()}`)}`);
  const { data: profile } = await supabase.from("users").select("full_name, email, team_role").eq("id", user.id).single();

  const clientId = one(searchParams.client_id);
  const redirectUri = one(searchParams.redirect_uri);
  const client = clientId ? await getClient(clientId) : null;
  const uriOk = client ? redirectUriAllowed(client, redirectUri) : false;
  const { granted, refused } = negotiateScopes(one(searchParams.scope));
  const isAgentSession = !!cookies().get(AGENT_SESSION_COOKIE);
  const problem = !clientId
    ? "This page only works when opened from an agent's authorization link, and this link has no client_id -- it was probably reloaded or typed by hand. Go back to the agent and ask it to restart the connection; it will send you here again with a fresh link."
    : !client ? `This authorization request names an unknown client (${clientId}). The agent may have registered under a different id -- ask it to restart the connection.` : !uriOk ? "The redirect address in this request is not registered for this client." : isAgentSession ? "A delegated agent session cannot authorize further agents. Sign in yourself to approve." : granted.length === 0 ? "None of the requested permissions can be granted." : null;
  let redirectHost = "";
  try { redirectHost = new URL(redirectUri).host; } catch { /* shown as-is */ }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#050505", color: "#F5F5F7" }}>
      <div className="w-full max-w-[460px] rounded-[14px] p-6" style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="text-[11px] uppercase tracking-[0.14em] text-[#6E6E73] mb-2">SFB Connect · Agent access</div>
        <h1 className="text-[20px] font-semibold leading-tight">
          {client ? <><span className="text-white">{client.client_name}</span> wants to connect to your workspace</> : "Authorization request"}
        </h1>
        <p className="text-[13px] text-[#A1A1A6] mt-2">
          Signed in as <span className="text-[#F5F5F7]">{profile?.full_name || profile?.email || user.email}</span>
          {profile?.team_role ? <> · {profile.team_role}</> : null} · workspace <span className="text-[#F5F5F7]">SFB Connect Team</span>
        </p>

        {problem ? (
          <div className="mt-5 rounded-[10px] p-4 text-[13px]" style={{ background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.25)", color: "#FF9F9A" }}>{problem}</div>
        ) : (
          <>
            <div className="mt-5 text-[12px] uppercase tracking-wide text-[#6E6E73]">This agent will be able to</div>
            <ul className="mt-2 flex flex-col gap-2">
              {granted.map((s) => (
                <li key={s} className="flex items-start gap-2 text-[13px]">
                  <span aria-hidden className="mt-[5px] inline-block h-[7px] w-[7px] rounded-full" style={{ background: s === "sfb:browser" ? "#FFD60A" : "#30D158" }} />
                  <span><span className="text-[#F5F5F7]">{describeScope(s)}</span> <span className="text-[#6E6E73] font-mono text-[11px]">{s}</span></span>
                </li>
              ))}
            </ul>
            {refused.length > 0 && (
              <div className="mt-3 text-[12px] text-[#A1A1A6]">
                Not granted (write access is never delegated to agents): <span className="font-mono text-[11px]">{refused.join(", ")}</span>
              </div>
            )}
            <div className="mt-4 rounded-[10px] p-3 text-[12px] text-[#A1A1A6]" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.06)" }}>
              The agent sees exactly what <span className="text-[#F5F5F7]">you</span> can see — nothing more. It never receives your password or your login cookies. Every request is logged, and you can revoke this connection at any time from Settings → Connected Agents.
              {redirectHost && <div className="mt-2">After you decide, you will be sent back to <span className="font-mono text-[11px] text-[#F5F5F7]">{redirectHost}</span>.</div>}
            </div>
            <form method="post" action="/api/v1/agent/oauth/approve" className="mt-5 flex items-center gap-3">
              {(["client_id", "redirect_uri", "state", "scope", "code_challenge", "code_challenge_method", "resource"] as const).map((k) => (
                <input key={k} type="hidden" name={k} value={one(searchParams[k])} />
              ))}
              <button type="submit" name="decision" value="approve" className="h-[38px] px-5 rounded-[9px] bg-white text-black text-[13px] font-semibold">Authorize {client?.client_name}</button>
              <button type="submit" name="decision" value="deny" className="h-[38px] px-4 rounded-[9px] text-[13px] text-[#F5F5F7]" style={{ border: "1px solid rgba(255,255,255,0.14)" }}>Cancel</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
