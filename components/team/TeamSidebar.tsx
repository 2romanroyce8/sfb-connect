"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Phone,
  CalendarClock,
  Bell,
  Sparkles,
  FileSearch,
  ClipboardList,
  Calendar,
  StickyNote,
  Activity,
  UserCog,
  BarChart3,
  Plug,
  Settings,
  LogOut,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string; icon: React.ElementType; ownerOnly?: boolean }[];
}[] = [
  {
    label: "Overview",
    items: [{ href: "/team/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Sales",
    items: [
      { href: "/team/leads", label: "Leads", icon: Users },
      { href: "/team/pipeline", label: "Pipeline", icon: Kanban },
      { href: "/team/calls", label: "Calls", icon: Phone },
      { href: "/team/meetings", label: "Meetings", icon: CalendarClock },
      { href: "/team/follow-ups", label: "Follow-Ups", icon: Bell },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/team/leads/import", label: "Lead Research", icon: FileSearch },
      { href: "/team/audits", label: "Business Audits", icon: ClipboardList },
      { href: "/team/scripts", label: "Scripts", icon: Sparkles },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/team/calendar", label: "Calendar", icon: Calendar },
      { href: "/team/notes", label: "Notes", icon: StickyNote },
      { href: "/team/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/team/team", label: "Team", icon: UserCog, ownerOnly: true },
      { href: "/team/performance", label: "Performance", icon: BarChart3, ownerOnly: true },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/team/integrations", label: "Integrations", icon: Plug, ownerOnly: true },
      { href: "/team/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function TeamSidebar({
  name,
  role,
}: {
  name: string;
  role: "owner" | "sales_rep";
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/team/login");
  }

  return (
    <aside
      className="w-[240px] shrink-0 h-screen sticky top-0 flex flex-col"
      style={{ background: "#0A0A0A", borderRight: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 text-[13px] font-semibold tracking-tight">
          <span className="w-5 h-5 rounded-full border border-white/25 inline-block" />
          SFB CONNECT
        </div>
        <div className="mt-1 text-[10.5px] text-[#6E6E73] tracking-wide uppercase">
          Sales OS
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.ownerOnly || role === "owner");
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-5">
              <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-[#6E6E73]">
                {group.label}
              </div>
              <div className="flex flex-col gap-[2px]">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] text-[13px] transition-colors"
                      style={{
                        background: active ? "#151515" : "transparent",
                        color: active ? "#F5F5F7" : "#A1A1A6",
                      }}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] font-bold shrink-0">
            {name?.slice(0, 1).toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] text-[#F5F5F7] truncate">{name}</div>
            <div className="text-[10.5px] text-[#6E6E73] capitalize">
              {role === "owner" ? "Owner" : "Sales Rep"}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] mt-1 rounded-[8px] text-[13px] text-[#A1A1A6] hover:text-white hover:bg-[#151515] transition-colors"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
