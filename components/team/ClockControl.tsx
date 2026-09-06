"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Circle, Loader2 } from "lucide-react";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function ClockControl({ activeSession }: { activeSession: { id: string; clocked_in_at: string } | null }) {
  const router = useRouter();
  const [session, setSession] = useState(activeSession);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(session.clocked_in_at).getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  async function toggle() {
    setLoading(true);
    try {
      if (session) {
        await fetch("/api/team/clock/out", { method: "POST" });
        setSession(null);
      } else {
        const res = await fetch("/api/team/clock/in", { method: "POST" });
        const data = await res.json();
        if (res.ok) setSession(data);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-3 pb-2">
      <button
        onClick={toggle}
        disabled={loading}
        className="w-full flex items-center justify-between px-2.5 py-2 rounded-[8px] text-[12px] disabled:opacity-60"
        style={{ background: session ? "rgba(48,209,88,0.1)" : "#101010", border: `1px solid ${session ? "rgba(48,209,88,0.3)" : "rgba(255,255,255,0.08)"}` }}
      >
        <span className="flex items-center gap-1.5">
          {loading ? (
            <Loader2 size={10} className="animate-spin text-[#6E6E73]" />
          ) : (
            <Circle size={8} fill={session ? "#30D158" : "#6E6E73"} className={session ? "text-[#30D158]" : "text-[#6E6E73]"} />
          )}
          <span style={{ color: session ? "#30D158" : "#A1A1A6" }}>{session ? "Work Mode" : "Personal Mode"}</span>
        </span>
        <span className="text-[#6E6E73]">{session ? formatDuration(elapsed) : "Clock In"}</span>
      </button>
    </div>
  );
}
