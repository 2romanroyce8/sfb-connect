"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Settings,
  UserPlus,
  SearchCheck,
  Clock3,
  TriangleAlert,
  CalendarCheck,
  Video,
  CalendarClock,
  CalendarX,
  ClipboardCheck,
  AtSign,
  ScrollText,
  CircleHelp,
  Workflow,
  CloudOff,
  Info,
} from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  action_label: string | null;
  secondary_action_url: string | null;
  secondary_action_label: string | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_ICON: Record<string, React.ElementType> = {
  lead_assigned: UserPlus,
  research_complete: SearchCheck,
  follow_up_due: Clock3,
  follow_up_overdue: TriangleAlert,
  meeting_booked: CalendarCheck,
  meeting_soon: Video,
  meeting_rescheduled: CalendarClock,
  meeting_cancelled: CalendarX,
  owner_task_assigned: ClipboardCheck,
  calendar_mention: AtSign,
  script_ready: ScrollText,
  quiz_required: CircleHelp,
  sop_required: Workflow,
  booking_sync_failed: CloudOff,
  system: Info,
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/team/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/team/notifications/mark-all-read", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      await fetch(`/api/team/notifications/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read" }) });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.action_url) {
      setOpen(false);
      router.push(n.action_url);
    }
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/team/notifications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dismiss" }) });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  const visible = tab === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "#18181E", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Bell size={19} color="#AFAFAF" />
        {unreadCount > 0 && <span className="absolute rounded-full" style={{ top: -2, right: -2, width: 9, height: 9, background: "#FF375F", border: "2px solid #0C0C0C" }} />}
      </button>

      {open && (
        <div
          className="absolute mt-1 flex flex-col"
          style={{
            top: "100%",
            right: 0,
            width: 452,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: 690,
            background: "#171918",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            boxShadow: "0 28px 70px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.01) inset",
            overflow: "hidden",
            zIndex: 1000,
            color: "#F5F5F7",
          }}
        >
          <div className="flex items-center justify-between shrink-0" style={{ height: 74, padding: "0 26px" }}>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "#F4F4F4" }}>Notifications</span>
            <button onClick={() => router.push("/team/settings")} style={{ color: "#B2B2B2" }}>
              <Settings size={19} />
            </button>
          </div>

          <div className="flex items-center justify-between shrink-0" style={{ height: 48, padding: "0 26px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center" style={{ gap: 24 }}>
              {(["all", "unread"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="relative capitalize"
                  style={{ height: 48, fontSize: 14, color: tab === t ? "#F5F5F7" : "#A6A6A6" }}
                >
                  {t}
                  {t === "unread" && unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center ml-1.5" style={{ height: 20, minWidth: 20, padding: "0 6px", borderRadius: 999, background: "#2A2C2B", color: "#AFAFAF", fontSize: 11 }}>
                      {unreadCount}
                    </span>
                  )}
                  {tab === t && <span className="absolute rounded-full" style={{ width: 18, height: 2, background: "#F2F2F2", bottom: 0, left: 0 }} />}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 13, color: "#B6B6B6" }}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 568, padding: "6px 0 10px" }}>
            {!loading && visible.length === 0 ? (
              <div className="flex flex-col items-center text-center" style={{ padding: "56px 24px" }}>
                <BellOff size={26} color="#777777" className="mb-3" />
                <div style={{ fontSize: 14, color: "#F1F1F1", fontWeight: 500 }}>You're all caught up</div>
                <div style={{ fontSize: 12.5, color: "#777777", marginTop: 4 }}>No notifications right now.</div>
              </div>
            ) : (
              visible.map((n) => {
                const Icon = TYPE_ICON[n.type] || Info;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className="grid cursor-pointer hover:bg-[#1B1D1C]"
                    style={{ gridTemplateColumns: "36px 1fr", gap: 12, padding: "16px 26px", borderBottom: "1px solid rgba(255,255,255,0.025)", background: !n.is_read ? "rgba(255,255,255,0.008)" : "transparent" }}
                  >
                    <div className="relative flex items-center justify-center rounded-[9px]" style={{ width: 34, height: 34, background: "#2A2C2B" }}>
                      <Icon size={17} color="#BDBDBD" />
                      {!n.is_read && <span className="absolute rounded-full" style={{ top: -1, right: -1, width: 8, height: 8, background: "#30D158", border: "2px solid #171918" }} />}
                    </div>
                    <div className="min-w-0">
                      <div style={{ fontSize: 14.5, fontWeight: 500, color: "#F1F1F1", lineHeight: 1.35 }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 13, color: "#D4D4D4", marginTop: 2 }}>{n.body}</div>}
                      <div style={{ fontSize: 11.5, color: "#868686", marginTop: 5 }}>{timeAgo(n.created_at)}</div>
                      {(n.action_label || n.secondary_action_label) && (
                        <div className="flex items-center" style={{ gap: 9, marginTop: 12 }}>
                          {n.action_label && (
                            <button
                              className="font-semibold"
                              style={{ height: 34, padding: "0 13px", background: "#F3F3F3", color: "#111111", borderRadius: 8, fontSize: 12.5 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClick(n);
                              }}
                            >
                              {n.action_label}
                            </button>
                          )}
                          {n.secondary_action_label && (
                            <button
                              style={{ height: 34, padding: "0 13px", background: "#333534", color: "#E6E6E6", border: "1px solid rgba(255,255,255,0.035)", borderRadius: 8, fontSize: 12.5 }}
                              onClick={(e) => dismiss(n.id, e)}
                            >
                              {n.secondary_action_label}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
