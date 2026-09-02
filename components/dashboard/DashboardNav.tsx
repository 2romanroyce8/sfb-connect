"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/score", label: "AI Presence Score" },
  { href: "/dashboard/findings", label: "Findings" },
  { href: "/dashboard/recommendations", label: "Recommendations" },
  { href: "/dashboard/report", label: "Presence Report" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/support", label: "Support" },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-full md:w-[240px] shrink-0 md:border-r border-white/10 md:min-h-screen px-6 py-8">
      <div className="font-extrabold text-base mb-10">
        SFB <span className="text-medium-gray font-semibold">CONNECT</span>
      </div>
      <nav className="flex flex-col gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? "bg-white text-black font-semibold"
                  : "text-medium-gray hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={handleSignOut}
        className="mt-10 text-sm text-medium-gray hover:text-white transition-colors"
      >
        Sign Out
      </button>
    </aside>
  );
}
