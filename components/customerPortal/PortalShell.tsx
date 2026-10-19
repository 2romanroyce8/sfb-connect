"use client";

import ThemeToggle from "@/components/ThemeToggle";
import { useState } from "react";
import Link from "next/link";
import TourProvider, { TourLauncher } from "@/components/tours/TourProvider";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Sparkles,
  TrendingUp,
  Zap,
  Users,
  FileText,
  CreditCard,
  LifeBuoy,
  Settings,
  LogOut,
  Menu,
  X,
  type LucideIcon,
  Bot,
  Coins,
  Plug,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AssistantWidget from "@/components/assistant/AssistantWidget";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, ready: true },
  { href: "/dashboard/agent", label: "Agent", icon: Bot, ready: true },
  { href: "/dashboard/credits", label: "Credits", icon: Coins, ready: true },
  { href: "/dashboard/presence", label: "AI Presence", icon: Sparkles, ready: true },
  { href: "/dashboard/progress", label: "Progress", icon: TrendingUp, ready: true },
  { href: "/dashboard/actions", label: "Actions", icon: Zap, ready: true },
  { href: "/dashboard/competitors", label: "Competitors", icon: Users, ready: true },
  { href: "/dashboard/reports", label: "Reports", icon: FileText, ready: true },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug, ready: true },
];

const SECONDARY_NAV: NavItem[] = [
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard, ready: true },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy, ready: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, ready: false },
];

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  if (!item.ready) {
    return (
      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-[13.5px] text-neutral-400 cursor-default select-none">
        <span className="flex items-center gap-3">
          <Icon size={17} strokeWidth={1.75} className="text-neutral-300" />
          {item.label}
        </span>
        <span className="text-[9.5px] font-medium uppercase tracking-wide text-neutral-300 border border-neutral-200 rounded-full px-2 py-0.5">
          Soon
        </span>
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      data-tour={`nav-${item.href.replace("/dashboard/", "").replace("/dashboard", "overview")}`}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${
        active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      <Icon size={17} strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}

export default function PortalShell({
  businessName,
  planLabel,
  displayName,
  children, setup }: {
  businessName: string;
  planLabel: string;
  displayName: string;
  children: React.ReactNode; setup?: { current: number; percent: number; remaining: number } | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));

  return (
    <TourProvider>
    <div className="min-h-screen bg-white text-neutral-900" data-authored="light">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[248px] border-r border-neutral-200 px-4 py-6">
        <div className="px-2 mb-8">
          <div className="text-[13px] font-semibold tracking-[0.08em] text-neutral-900">SFB CONNECT</div>
        </div>

        <div className="px-2 mb-6 pb-5 border-b border-neutral-200">
          <div className="text-[14px] font-semibold text-neutral-900 truncate">{businessName}</div>
          <div className="text-[12px] text-neutral-500 mt-0.5">{planLabel}</div>
        </div>

        {setup && setup.remaining > 0 && (
          <Link href="/dashboard/onboarding" className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] ${pathname.startsWith("/dashboard/onboarding") ? "bg-neutral-900 text-white" : "bg-neutral-50 border border-neutral-200 text-neutral-900 hover:bg-neutral-100"}`}>
            <span className="font-medium">Finish setup</span><span className="text-[11.5px] opacity-70">{setup.percent}% · step {setup.current}</span>
          </Link>
        )}
        <nav className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="my-4 border-t border-neutral-200" />

        <nav className="flex flex-col gap-0.5">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="mt-auto pt-5 border-t border-neutral-200 px-2">
          <div className="flex items-center justify-between gap-2"><div className="text-[13px] font-medium text-neutral-800 truncate">{displayName}</div><div className="flex items-center gap-1.5"><ThemeToggle compact className="!w-[30px] !h-[30px]" /><TourLauncher compact /></div></div>
          <button
            onClick={handleSignOut}
            className="mt-2 flex items-center gap-2 text-[12.5px] text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Log Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div>
          <div className="text-[13px] font-semibold text-neutral-900 leading-tight">{businessName}</div>
          <div className="text-[11px] text-neutral-500 leading-tight">{planLabel}</div>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} aria-label="Open menu" className="p-2 -mr-2">
          <Menu size={20} strokeWidth={1.75} />
        </button>
      </header>

      {/* Mobile "More" menu overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white flex flex-col">
          <div className="flex items-center justify-between h-14 px-4 border-b border-neutral-200">
            <div className="text-[13px] font-semibold tracking-[0.08em]">SFB CONNECT</div>
            <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="p-2 -mr-2">
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5">
            {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={() => setMobileMenuOpen(false)} />
            ))}
          </nav>
          <div className="px-4 py-4 border-t border-neutral-200">
            <div className="text-[13px] font-medium text-neutral-800">{displayName}</div>
            <button
              onClick={handleSignOut}
              className="mt-2 flex items-center gap-2 text-[12.5px] text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <LogOut size={14} strokeWidth={1.75} />
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav -- primary destinations only, per spec */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch border-t border-neutral-200 bg-white/95 backdrop-blur">
        {[PRIMARY_NAV[0], PRIMARY_NAV[1], PRIMARY_NAV[2], PRIMARY_NAV[3]].map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return item.ready ? (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                active ? "text-neutral-900" : "text-neutral-400"
              }`}
            >
              <Icon size={19} strokeWidth={1.75} />
              {item.label}
            </Link>
          ) : (
            <div key={item.href} className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-neutral-300">
              <Icon size={19} strokeWidth={1.75} />
              {item.label}
            </div>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-neutral-400"
        >
          <Menu size={19} strokeWidth={1.75} />
          More
        </button>
      </nav>

      <main className="md:pl-[248px] pb-20 md:pb-0">
        <div className="max-w-[880px] mx-auto px-5 md:px-10 py-8 md:py-12">{children}</div>
        <AssistantWidget endpoint="/api/dashboard/assistant" theme="light" title="Your SFB Assistant" />
      </main>
    </div>
    </TourProvider>
  );
}
