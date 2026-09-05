import { redirect } from "next/navigation";
import { CalendarDays, Bot, PhoneCall, MessageSquare, Mail } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
const INTEGRATIONS = [
  {
    name: "Google Calendar",
    icon: CalendarDays,
    status: "Needs Setup",
    description: "Read availability, auto-create events, and generate Google Meet links when a meeting is booked.",
  },
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

export default async function IntegrationsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  if (caller?.team_role !== "owner") redirect("/team/dashboard");

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Integrations</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Connect external services to the Sales OS.</div>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-[760px]">
        {INTEGRATIONS.map((i) => (
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
    </div>
  );
}
