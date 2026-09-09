"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LOGO_SRC =
  "https://pub.hyperagent.com/api/published/pbf01M20H817H_JC6RBZ3RQ3YAXVV2/sfb_logo_mark_cropped.png";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Phone,
  CalendarClock,
  Bell,
  FileSearch,
  ClipboardList,
  Calendar,
  StickyNote,
  Activity,
  GanttChartSquare,
  UserCog,
  BarChart3,
  Plug,
  Images,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import ClockControl from "./ClockControl";
import SidebarSearch from "./SidebarSearch";

// Every item here maps to a route that actually exists and renders real
// data — no "Favorites"/"Notifications"/"Automations" placeholders just to
// match a reference's row count. Density comes from real navigation, not
// invented pages.
const NAV_GROUPS: {
  label: string | null;
  collapsible: boolean;
  items: { href: string; label: string; icon: React.ElementType; ownerOnly?: boolean }[];
}[] = [
  {
    label: null,
    collapsible: false,
    items: [
      { href: "/team/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/team/clock", label: "Clock", icon: CalendarClock },
    ],
  },
  {
    label: "Records",
    collapsible: true,
    items: [{ href: "/team/leads", label: "Leads", icon: Users }],
  },
  {
    label: "Sales",
    collapsible: true,
    items: [
      { href: "/team/pipeline", label: "Pipeline", icon: Kanban },
      { href: "/team/calls", label: "Calls", icon: Phone },
      { href: "/team/meetings", label: "Meetings", icon: CalendarClock },
      { href: "/team/follow-ups", label: "Follow-Ups", icon: Bell },
      { href: "/team/work-plan", label: "Work Plan", icon: GanttChartSquare },
    ],
  },
  {
    label: "AI",
    collapsible: true,
    items: [
      { href: "/team/leads/import", label: "Lead Research", icon: FileSearch },
      { href: "/team/research", label: "Research Queue", icon: ClipboardList },
      { href: "/team/audits", label: "Business Audits", icon: ClipboardList },
    ],
  },
  {
    label: "Workspace",
    collapsible: true,
    items: [
      { href: "/team/calendar", label: "Calendar", icon: Calendar },
      { href: "/team/notes", label: "Notes", icon: StickyNote },
      { href: "/team/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "Team",
    collapsible: true,
    items: [
      { href: "/team/team", label: "Team", icon: UserCog, ownerOnly: true },
      { href: "/team/performance", label: "Performance", icon: BarChart3, ownerOnly: true },
      { href: "/team/portfolio", label: "Portfolio", icon: Images, ownerOnly: true },
    ],
  },
  {
    label: "System",
    collapsible: true,
    items: [
      { href: "/team/integrations", label: "Integrations", icon: Plug, ownerOnly: true },
      { href: "/team/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function TeamSidebar({
  name,
  role,
  activeSession,
}: {
  name: string;
  role: "owner" | "sales_rep";
  activeSession: { id: string; clocked_in_at: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/team/login");
  }

  return (
    <aside
      className="w-[260px] shrink-0 h-screen sticky top-0 flex flex-col"
      style={{ background: "#0C0C0C", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="px-[18px] pt-[18px] pb-1 flex items-center gap-2" style={{ height: 44 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="SFB Connects" className="w-5 h-auto shrink-0" />
        <span className="text-[16px] font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
          SFB CONNECTS
        </span>
      </div>
      <div className="px-[18px] pb-1 text-[10px] text-[#6E6E73] tracking-wide uppercase">Sales OS</div>

      <SidebarSearch />

      <div className="pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <ClockControl activeSession={activeSession} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((group, gi) => {
          const items = group.items.filter((i) => !i.ownerOnly || role === "owner");
          if (items.length === 0) return null;
          const isCollapsed = group.label ? collapsed[group.label] : false;
          return (
            <div key={group.label || gi} className="mb-4">
              {group.label && (
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [group.label!]: !c[group.label!] }))}
                  className="w-full flex items-center justify-between px-2 mb-1 text-[10px] font-semibold tracking-[0.1em] uppercase text-[#6E6E73] hover:text-[#A1A1A6]"
                >
                  {group.label}
                  {group.collapsible && (
                    <ChevronDown size={11} style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 120ms" }} />
                  )}
                </button>
              )}
              {!isCollapsed && (
                <div className="flex flex-col gap-[1px]">
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-[11px] px-2.5 rounded-[5px] text-[14px] transition-colors"
                        style={{ height: 36, background: active ? "#151515" : "transparent", color: active ? "#FFFFFF" : "#A1A1A6" }}
                      >
                        <Icon size={16} strokeWidth={1.75} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
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
