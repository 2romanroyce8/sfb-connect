import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import IntegrationControlDeck from "@/components/team/IntegrationControlDeck";

// Every value fed into IntegrationControlDeck below is real: Google
// Calendar's connection/refresh state comes straight from
// crm_calendar_connections, and Apple Calendar / AI Provider / Messaging
// are all still genuinely unbuilt, so their statuses stay "Needs Setup" /
// "Disconnected" and their CTA is disabled rather than pretending a
// connect flow exists.

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
    .select("google_email, connected_at, refresh_failed_at")
    .eq("rep_id", user!.id)
    .maybeSingle();
  // The short-lived access token expires roughly hourly and is refreshed
  // transparently on demand (lib/crm/googleCalendar.ts) -- that expiry is
  // NOT a sign of a broken connection, so it's never used here. The only
  // real signal that the connection needs reconnecting is a refresh_token
  // that Google itself rejected (refresh_failed_at gets set when that
  // happens, and cleared the next time a refresh succeeds).
  const myConnection = myConnRow
    ? { email: myConnRow.google_email || "", connectedAt: myConnRow.connected_at, valid: !myConnRow.refresh_failed_at }
    : null;

  let teamConnections: { repName: string; email: string | null; connectedAt: string; valid: boolean }[] = [];
  if (isOwner) {
    const [{ data: conns }, { data: reps }] = await Promise.all([
      service.from("crm_calendar_connections").select("rep_id, google_email, connected_at, refresh_failed_at"),
      supabase.from("users").select("id, full_name, email").not("team_role", "is", null),
    ]);
    const repNames: Record<string, string> = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));
    teamConnections = (conns ?? []).map((c) => ({
      repName: repNames[c.rep_id] || "—",
      email: c.google_email,
      connectedAt: c.connected_at,
      valid: !c.refresh_failed_at,
    }));
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Integrations</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Connect external services to the Sales OS.</div>
      </div>

      {searchParams.error && (
        <div className="mb-4 max-w-[900px] rounded-[10px] p-3 text-[12.5px] text-[#FF453A]" style={{ background: "rgba(255,69,58,0.08)" }}>
          {decodeURIComponent(searchParams.error)}
        </div>
      )}
      {searchParams.connected && (
        <div className="mb-4 max-w-[900px] rounded-[10px] p-3 text-[12.5px] text-[#30D158]" style={{ background: "rgba(48,209,88,0.08)" }}>
          Connected as {decodeURIComponent(searchParams.connected)}.
        </div>
      )}

      <IntegrationControlDeck
        google={myConnection}
        teamConnections={teamConnections}
        isOwner={isOwner}
        appleCalendar={{
          status: "Needs Setup",
          description:
            "Every meeting page includes an ICS download so reps can add events to Apple Calendar (or any calendar app) manually. There's no account-level Apple Calendar connection yet.",
        }}
        aiProvider={{
          status: "Needs Setup",
          description: "Powers the global Sales Assistant. Not required for audits or scripts, which are deterministic.",
        }}
        messaging={[
          {
            name: "Telephony",
            status: "Disconnected",
            description: "Calls currently run as Device Calls — the CRM tracks them, but dialing happens on the rep's own phone.",
          },
          {
            name: "SMS",
            status: "Disconnected",
            description: "Send text reminders and confirmations to leads.",
          },
          {
            name: "Email",
            status: "Needs Setup",
            description: "Send meeting confirmations and follow-up emails from the CRM.",
          },
        ]}
      />
    </div>
  );
}
