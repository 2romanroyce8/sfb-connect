import { CalendarDays, Bot, PhoneCall, MessageSquare, Mail } from "lucide-react";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import GoogleCalendarCard from "@/components/team/GoogleCalendarCard";

const STATUS_COLOR: Record<string, string> = {
  Connected: "#30D158",
  "Needs Setup": "#FFD60A",
  Disconnected: "#6E6E73",
  Error: "#FF453A",
};

// Every card here reflects what's actually wired in this codebase today.
// None of these have a real OAuth connection or API credential configured
// yet, so none of them are allowed to say "Connected" — that would be a
// fabricated status.
const COMPANY_INTEGRATIONS = [
  {
    name: "Apple Calendar",
    icon: CalendarDays,
    status: "Needs Setup",
    description: "ICS calendar subscription for meetings and follow-ups.",
  },
  {
    name: "AI Provider",
    icon: Bot,
    status: "Needs Setup",
    description: "Used for the global Sales Assistant — not required for audits or scripts, which are deterministic.",
  },
  {
    name: "Telephony",
    icon: PhoneCall,
    status: "Disconnected",
    description: "Calls currently run as Device Calls — the CRM tracks them, but dialing happens on the rep's own phone.",
  },
  {
    name: "SMS",
    icon: MessageSquare,
    status: "Disconnected",
    description: "Send text reminders and confirmations to leads.",
  },
  {
    name: "Email",
    icon: Mail,
    status: "Needs Setup",
    description: "Send meeting confirmations and follow-up emails from the CRM.",
  },
];

export default async function IntegrationsPage({ searchParams }: { searchParams: { connected?: string; error?: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  // Deliberately the service client, and deliberately selecting only
  // metadata columns -- this is the ONE place allowed to read this table,
  // and it never selects access_token_enc / refresh_token_enc.
  const service = createSupabaseServiceClient();
  const { data: myConnRow } = await service
    .from("crm_calendar_connections")
    .select("google_email, connected_at, token_expires_at")
    .eq("rep_id", user!.id)
    .maybeSingle();
  const myConnection = myConnRow
    ? { google_email: myConnRow.google_email, connected_at: myConnRow.connected_at, token_currently_valid: new Date(myConnRow.token_expires_at) > new Date() }
    : null;

  let teamConnections: { rep_id: string; google_email: string | null; connected_at: string }[] = [];
  let repNames: Record<string, string> = {};
  if (isOwner) {
    const [{ data: conns }, { data: reps }] = await Promise.all([
      service.from("crm_calendar_connections").select("rep_id, google_email, connected_at"),
      supabase.from("users").select("id, full_name, email").not("team_role", "is", null),
    ]);
    teamConnections = conns ?? [];
    repNames = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Integrations</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Connect external services to the Sales OS.</div>
      </div>

      {searchParams.error && (
        <div className="mb-4 max-w-[760px] rounded-[10px] p-3 text-[12.5px] text-[#FF453A]" style={{ background: "rgba(255,69,58,0.08)" }}>
          {decodeURIComponent(searchParams.error)}
        </div>
      )}
      {searchParams.connected && (
        <div className="mb-4 max-w-[760px] rounded-[10px] p-3 text-[12.5px] text-[#30D158]" style={{ background: "rgba(48,209,88,0.08)" }}>
          Connected as {decodeURIComponent(searchParams.connected)}.
        </div>
      )}

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">My Calendar</div>
      <div className="grid grid-cols-2 gap-3 max-w-[760px] mb-8">
        <GoogleCalendarCard connection={myConnection as any} />
      </div>

      {isOwner && teamConnections.length > 0 && (
        <>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">Team Calendar Connections</div>
          <div className="rounded-[12px] overflow-hidden mb-8 max-w-[760px]" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: "#0A0A0A" }}>
                  {["Rep", "Google Account", "Connected"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamConnections.map((c) => (
                  <tr key={c.rep_id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <td className="px-4 py-3 text-[#F5F5F7]">{repNames[c.rep_id] || "—"}</td>
                    <td className="px-4 py-3 text-[#A1A1A6]">{c.google_email || "—"}</td>
                    <td className="px-4 py-3 text-[#6E6E73]">{new Date(c.connected_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-[#6E6E73] max-w-[760px] mb-8">
            Roman sees who's connected and when — never the underlying Google tokens, which stay encrypted and
            server-side per rep.
          </p>
        </>
      )}

      {isOwner && (
        <>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">Company-Wide</div>
          <div className="grid grid-cols-2 gap-3 max-w-[760px]">
            {COMPANY_INTEGRATIONS.map((i) => (
              <div key={i.name} className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <i.icon size={16} className="text-[#A1A1A6]" strokeWidth={1.75} />
                    <span className="text-[13.5px] text-[#F5F5F7]">{i.name}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: STATUS_COLOR[i.status] }}>
                    <span className="w-[6px] h-[6px] rounded-full" style={{ background: STATUS_COLOR[i.status] }} />
                    {i.status}
                  </span>
                </div>
                <p className="text-[12px] text-[#6E6E73] leading-relaxed">{i.description}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
