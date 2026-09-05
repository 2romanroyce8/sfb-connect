import Link from "next/link";
import { Users, CheckCircle2, CalendarCheck, Trophy } from "lucide-react";

type Rep = { id: string; full_name: string | null; email: string };

const METRIC_ICONS = [Users, CheckCircle2, CalendarCheck, Trophy];

export default function OwnerDashboard({
  name,
  totalLeads,
  qualifiedLeads,
  meetingsBooked,
  won,
  reps,
}: {
  name: string;
  totalLeads: number;
  qualifiedLeads: number;
  meetingsBooked: number;
  won: number;
  reps: Rep[];
}) {
  const metrics = [
    { label: "Total Leads", value: totalLeads },
    { label: "Qualified Leads", value: qualifiedLeads },
    { label: "Meetings Booked", value: meetingsBooked },
    { label: "Deals Won", value: won },
  ];

  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <div className="mb-8">
        <div className="text-[22px] font-semibold text-[#F5F5F7]">Good day, {name}</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Company command center</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {metrics.map((m, i) => {
          const Icon = METRIC_ICONS[i];
          return (
            <div
              key={m.label}
              className="p-4 rounded-[12px]"
              style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Icon size={16} className="text-[#6E6E73] mb-3" strokeWidth={1.75} />
              <div className="text-[26px] font-semibold text-[#F5F5F7] leading-none">{m.value}</div>
              <div className="text-[11.5px] text-[#6E6E73] mt-1.5">{m.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-3 text-[13px] font-semibold text-[#F5F5F7]">Team</div>
      {reps.length === 0 ? (
        <div
          className="rounded-[12px] p-6 text-center"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-[13px] text-[#A1A1A6]">
            No sales reps provisioned yet. Ashton and Logan need Supabase Auth
            accounts with <code className="text-[#F5F5F7]">team_role = &apos;sales_rep&apos;</code> set
            on their <code className="text-[#F5F5F7]">public.users</code> row before they&apos;ll show up
            here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {reps.map((rep) => (
            <div
              key={rep.id}
              className="flex items-center justify-between p-4 rounded-[12px]"
              style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-[12px] font-bold">
                  {(rep.full_name || rep.email).slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-[13.5px] text-[#F5F5F7]">{rep.full_name || rep.email}</div>
                  <div className="text-[11px] text-[#6E6E73]">Sales Rep</div>
                </div>
              </div>
              <Link
                href={`/team/team/${rep.id}`}
                className="text-[12px] text-[#A1A1A6] hover:text-white"
              >
                View performance →
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 flex gap-3">
        <Link
          href="/team/leads/import"
          className="h-[38px] px-4 inline-flex items-center rounded-[8px] bg-white text-black text-[13px] font-semibold"
        >
          Research a Business
        </Link>
        <Link
          href="/team/leads"
          className="h-[38px] px-4 inline-flex items-center rounded-[8px] text-[13px] text-[#A1A1A6]"
          style={{ border: "1px solid rgba(255,255,255,0.12)" }}
        >
          View All Leads
        </Link>
      </div>
    </div>
  );
}
