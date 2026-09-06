import Link from "next/link";

type Lead = {
  id: string;
  business_name: string | null;
  pipeline_stage: string;
  updated_at: string;
  assigned_rep_name?: string | null;
};

const STAGE_LABEL: Record<string, string> = {
  new: "New",
  researching: "Researching",
  ready_to_call: "Ready to Call",
  contacted: "Contacted",
  interested: "Interested",
  follow_up: "Follow-Up",
  meeting_booked: "Meeting Booked",
  meeting_completed: "Meeting Completed",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
};

// "Next Action" is derived deterministically from pipeline_stage — never a
// model guess — so it's always explainable from data already on the record.
const NEXT_ACTION: Record<string, string> = {
  new: "Research",
  researching: "Finish research",
  ready_to_call: "Call",
  contacted: "Follow up",
  interested: "Book a meeting",
  follow_up: "Follow up",
  meeting_booked: "Prepare for meeting",
  meeting_completed: "Send proposal",
  proposal: "Close",
  won: "—",
  lost: "—",
  nurture: "Re-research later",
};

export default function RecentLeadsTable({ leads, showRep }: { leads: Lead[]; showRep: boolean }) {
  return (
    <div className="rounded-[8px] overflow-hidden" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div
        className="flex items-center gap-2.5 px-6"
        style={{ height: 58, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span className="text-[15px] font-medium text-[#F5F5F7]">Recent Lead Activity</span>
        <span className="text-[13px] text-[#D0D0D0]">
          {leads.length} lead{leads.length === 1 ? "" : "s"}
        </span>
      </div>

      {leads.length === 0 ? (
        <div className="px-6 py-8 text-[13px] text-[#6E6E73]">No leads yet.</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: "#111111" }}>
              {["Business", ...(showRep ? ["Assigned Rep"] : []), "Stage", "Last Contact", "Next Action"].map((h) => (
                <th key={h} className="text-left px-4 font-medium" style={{ height: 40, fontSize: 12, color: "#8A8A8A", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-[#161616]" style={{ height: 52, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-4">
                  <Link href={`/team/leads/${l.id}`} className="text-[#D8D8D8] hover:text-white">
                    {l.business_name || "Unnamed lead"}
                  </Link>
                </td>
                {showRep && <td className="px-4 text-[#A1A1A6]">{l.assigned_rep_name || "Unassigned"}</td>}
                <td className="px-4 text-[#A1A1A6]">{STAGE_LABEL[l.pipeline_stage] || l.pipeline_stage}</td>
                <td className="px-4 text-[#A1A1A6]">{new Date(l.updated_at).toLocaleDateString()}</td>
                <td className="px-4 text-[#A1A1A6]">{NEXT_ACTION[l.pipeline_stage] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
