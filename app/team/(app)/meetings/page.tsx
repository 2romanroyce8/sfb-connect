import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MeetingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const { data: meetings } = await supabase
    .from("crm_meetings")
    .select("id, lead_id, rep_id, scheduled_at, contact_name, contact_email, google_meet_url, status")
    .order("scheduled_at", { ascending: true });

  const leadIds = Array.from(new Set((meetings ?? []).map((m) => m.lead_id)));
  const repIds = Array.from(new Set((meetings ?? []).map((m) => m.rep_id)));
  const [{ data: leads }, { data: reps }] = await Promise.all([
    leadIds.length ? supabase.from("crm_leads").select("id, business_name").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
    isOwner && repIds.length ? supabase.from("users").select("id, full_name, email").in("id", repIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l.business_name]));
  const repMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));

  const now = new Date();
  const upcoming = (meetings ?? []).filter((m) => m.status === "booked" && new Date(m.scheduled_at) >= now);
  const past = (meetings ?? []).filter((m) => new Date(m.scheduled_at) < now || m.status !== "booked");

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Meetings</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">{upcoming.length} upcoming</div>
      </div>

      {(!meetings || meetings.length === 0) ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No meetings booked</div>
          <p className="text-[13px] text-[#A1A1A6]">Booking a meeting from a call's outcome sheet will list it here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <Section title="Upcoming" meetings={upcoming} leadMap={leadMap} repMap={repMap} isOwner={isOwner} />
          <Section title="Past / Other" meetings={past} leadMap={leadMap} repMap={repMap} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}

function Section({ title, meetings, leadMap, repMap, isOwner }: { title: string; meetings: any[]; leadMap: Record<string, string>; repMap: Record<string, string>; isOwner: boolean }) {
  if (meetings.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">{title}</div>
      <div className="flex flex-col gap-2">
        {meetings.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div>
              <Link href={`/team/leads/${m.lead_id}`} className="text-[13.5px] text-[#F5F5F7] hover:underline">
                {leadMap[m.lead_id] || "Unknown lead"}
              </Link>
              <div className="text-[12px] text-[#6E6E73] mt-0.5">
                {new Date(m.scheduled_at).toLocaleString()} {isOwner && repMap[m.rep_id] ? `· ${repMap[m.rep_id]}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11.5px] text-[#A1A1A6] capitalize">{m.status}</div>
              {m.google_meet_url ? (
                <a href={m.google_meet_url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-[#0A84FF]">
                  Join
                </a>
              ) : (
                <div className="text-[11px] text-[#6E6E73]">No video link yet</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
