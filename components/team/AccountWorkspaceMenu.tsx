"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleHelp, ContactRound, UserRoundCog, UsersRound, Settings, LogOut, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import NotificationsPanel from "./NotificationsPanel";

type Props = {
  name: string;
  email: string;
  role: "owner" | "sales_rep";
  avatarUrl?: string | null;
  activeSession: { id: string; clocked_in_at: string } | null;
};

// The "workspace switcher" here isn't decorative -- it's the same
// clock-in/Work-Mode system built earlier, just given the reference's
// Personal/Company framing. Switching to "SFB Connects" clocks you in;
// switching to "Personal" clocks you out. One real system, two surfaces.
export default function AccountWorkspaceMenu({ name, email, role, avatarUrl, activeSession }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(activeSession);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function switchWorkspace(target: "personal" | "company") {
    const wantWork = target === "company";
    if (wantWork === !!session) return;
    setSwitching(true);
    try {
      const res = await fetch(`/api/team/clock/${wantWork ? "in" : "out"}`, { method: "POST" });
      if (res.ok) {
        setSession(wantWork ? { id: "pending", clocked_in_at: new Date().toISOString() } : null);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/team/login");
  }

  const initial = name.slice(0, 1).toUpperCase();
  const menuItems = [
    { label: "Personal Info", icon: ContactRound, href: "/team/settings#profile" },
    { label: "Account Security", icon: UserRoundCog, href: "/team/settings#security" },
    ...(role === "owner" ? [{ label: "Manage Users", icon: UsersRound, href: "/team/team" }] : []),
    { label: "Settings", icon: Settings, href: "/team/settings" },
  ];

  return (
    <div className="fixed top-4 right-4 z-40" ref={menuRef}>
      <div className="flex items-center justify-end gap-2 mb-2">
        <a
          href="mailto:support@sfbconnect.com"
          className="hidden md:flex items-center gap-2 h-[36px] px-3.5 rounded-[10px] text-[12.5px]"
          style={{ background: "#18181E", border: "1px solid rgba(255,255,255,0.08)", color: "#E7E7EA" }}
        >
          <CircleHelp size={15} /> Help
        </a>
        <NotificationsPanel />
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[12px] font-bold overflow-hidden"
          style={{ background: "#18181E", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </button>
      </div>

      {open && (
        <div
          className="absolute right-0 mt-1 origin-top-right"
          style={{
            width: 400,
            maxWidth: "calc(100vw - 32px)",
            background: "#121217",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.015) inset",
            overflow: "hidden",
            color: "#F5F5F7",
          }}
        >
          {/* header */}
          <div className="flex items-center gap-4" style={{ padding: "26px 26px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="rounded-[14px] flex items-center justify-center shrink-0" style={{ width: 56, height: 56, background: "#222228", border: "1px solid rgba(255,255,255,0.08)", fontSize: 20, fontWeight: 600 }}>
              {initial}
            </div>
            <div className="min-w-0">
              <div className="truncate" style={{ fontSize: 18, fontWeight: 600, color: "#F7F7F8" }}>
                {name}
              </div>
              <div className="truncate" style={{ fontSize: 13, color: "#8F8F96", marginTop: 2 }}>
                {email}
              </div>
            </div>
          </div>

          {/* workspace switcher */}
          <div style={{ padding: "18px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ background: "#0F0F13", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#A3A3A9", marginBottom: 14 }}>Switch Workspaces</div>

              <button
                onClick={() => switchWorkspace("company")}
                disabled={switching}
                className="w-full grid items-center disabled:opacity-60"
                style={{ gridTemplateColumns: "42px 1fr auto", gap: 12, marginBottom: 10 }}
              >
                <div className="rounded-[10px] flex items-center justify-center" style={{ width: 42, height: 42, background: "#20C7B7", fontSize: 18, fontWeight: 500, color: "#FFFFFF" }}>
                  S
                </div>
                <div className="text-left min-w-0">
                  <div className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F7" }}>
                    SFB Connects
                  </div>
                  <div style={{ fontSize: 12, color: "#A3A3A9" }}>Work Mode</div>
                </div>
                {session && <Check size={16} className="text-[#20C7B7]" />}
              </button>

              <button onClick={() => switchWorkspace("personal")} disabled={switching} className="w-full grid items-center disabled:opacity-60" style={{ gridTemplateColumns: "42px 1fr auto", gap: 12 }}>
                <div className="rounded-[10px] flex items-center justify-center" style={{ width: 42, height: 42, background: "#19191F", border: "1px solid rgba(255,255,255,0.06)", color: "#E7E7E9" }}>
                  {initial}
                </div>
                <div className="text-left min-w-0">
                  <div className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F7" }}>
                    Personal
                  </div>
                  <div style={{ fontSize: 12, color: "#A3A3A9" }}>Personal Mode</div>
                </div>
                {!session && <Check size={16} className="text-[#20C7B7]" />}
              </button>
            </div>
          </div>

          {/* menu items */}
          <div className="flex flex-col" style={{ padding: "10px 22px", gap: 2 }}>
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center group"
                style={{ height: 50, gap: 16, fontSize: 15, fontWeight: 500, color: "#F3F3F5" }}
              >
                <item.icon size={19} strokeWidth={1.8} className="text-[#B2B2B8] group-hover:text-white transition-colors shrink-0" />
                <span className="group-hover:text-white transition-colors">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* logout */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 22px 18px" }}>
            <button onClick={handleLogout} className="flex items-center w-full" style={{ height: 50, gap: 16, fontSize: 15, fontWeight: 500, color: "#F4F4F6" }}>
              <LogOut size={19} className="text-[#B4B4BA]" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
