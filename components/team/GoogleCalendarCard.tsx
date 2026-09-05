"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";

type Connection = { google_email: string | null; connected_at: string; token_currently_valid: boolean } | null;

export default function GoogleCalendarCard({ connection }: { connection: Connection }) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/team/integrations/google/disconnect", { method: "POST" });
      window.location.reload();
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = !!connection;
  const status = connected ? (connection!.token_currently_valid ? "Connected" : "Needs Reconnect") : "Not Connected";
  const color = connected ? (connection!.token_currently_valid ? "#30D158" : "#FFD60A") : "#6E6E73";

  return (
    <div className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[#A1A1A6]" strokeWidth={1.75} />
          <span className="text-[13.5px] text-[#F5F5F7]">Google Calendar</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: color }} />
          {status}
        </span>
      </div>

      {connected ? (
        <>
          <p className="text-[12px] text-[#A1A1A6] mb-1">
            Connected as <span className="text-[#F5F5F7]">{connection!.google_email}</span>
          </p>
          <p className="text-[11.5px] text-[#6E6E73] mb-3">Since {new Date(connection!.connected_at).toLocaleDateString()}</p>
          <div className="text-[11.5px] text-[#30D158] mb-3">
            ✓ Read availability &nbsp; ✓ Create events &nbsp; ✓ Google Meet
          </div>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="h-[32px] px-3 rounded-[7px] text-[12px] text-[#FF453A] disabled:opacity-60"
            style={{ border: "1px solid rgba(255,69,58,0.3)" }}
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </>
      ) : (
        <>
          <p className="text-[12px] text-[#6E6E73] mb-3">
            Read availability, auto-create events, and generate Google Meet links when you book a meeting.
          </p>
          <a
            href="/api/team/integrations/google/connect"
            className="inline-flex h-[34px] px-4 items-center rounded-[8px] bg-white text-black text-[12.5px] font-semibold"
          >
            Connect Google Calendar
          </a>
        </>
      )}
    </div>
  );
}
