"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Presentation, Palette, LogOut, Users, Kanban, Bell, CreditCard, Building2, PackageCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Same shell/styling as the team sidebar (Roman: keep the UI, change the tabs). Only routes that exist and render real data are listed;
// each later phase adds its tab when its page ships (Clients, Fulfillment, Automations, Appointments, Team, Revenue, Usage, Billing).
const ITEMS: { href: string; label: string; icon: React.ElementType }[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/leads", label: "Prospects", icon: Users },
  { href: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/app/followups", label: "Follow-ups", icon: Bell },
  { href: "/app/clients", label: "Clients", icon: Building2 },
  { href: "/app/orders", label: "Orders", icon: PackageCheck },
  { href: "/app/demos", label: "Demo Builder", icon: Presentation },
  { href: "/app/branding", label: "Branding", icon: Palette },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

export default function AgencySidebar({ agencyName, userName, role }: { agencyName: string; userName: string; role: string }) {
  const pathname = usePathname(); const router = useRouter();
  async function logout() { await createSupabaseBrowserClient().auth.signOut(); router.push("/login"); }
  return (
    <aside className="w-[260px] shrink-0 h-screen sticky top-0 flex flex-col" style={{ background: "var(--hx-0c0c0c)", borderRight: "1px solid rgb(var(--w) / 0.06)" }}>
      <div className="px-[18px] pt-[18px] pb-1 text-[16px] font-semibold tracking-tight truncate" style={{ height: 44 }}>{agencyName}</div>
      <div className="px-[18px] pb-3 text-[10px] text-[color:var(--hx-6e6e73)] tracking-wide uppercase">Agency workspace · powered by SFB Connect</div>
      <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-[1px]">
        {ITEMS.map((i) => {
          const active = i.href === "/app" ? pathname === "/app" : pathname.startsWith(i.href); const Icon = i.icon;
          return <Link key={i.href} href={i.href} className="flex items-center gap-[11px] px-2.5 rounded-[5px] text-[14px] transition-colors" style={{ height: 36, background: active ? "var(--hx-151515)" : "transparent", color: active ? "var(--hx-ffffff)" : "var(--hx-a1a1a6)" }}><Icon size={16} strokeWidth={1.75} />{i.label}</Link>;
        })}
      </nav>
      <div className="px-3 py-4" style={{ borderTop: "1px solid rgb(var(--w) / 0.08)" }}>
        <div className="px-2.5 py-2"><div className="text-[12.5px] text-[color:var(--hx-f5f5f7)] truncate">{userName}</div><div className="text-[10.5px] text-[color:var(--hx-6e6e73)] capitalize">{role.replace(/_/g, " ")}</div></div>
        <div className="flex items-center justify-between px-2.5 py-[6px] mt-1 text-[12.5px] text-[color:var(--hx-a1a1a6)]"><span>Appearance</span><ThemeToggle compact className="!w-[30px] !h-[30px]" /></div>
        <button onClick={logout} className="w-full flex items-center gap-2.5 px-2.5 py-[7px] mt-1 rounded-[8px] text-[13px] text-[color:var(--hx-a1a1a6)] hover:text-white hover:bg-[color:var(--hx-151515)] transition-colors"><LogOut size={15} strokeWidth={1.75} />Log Out</button>
      </div>
    </aside>
  );
}
