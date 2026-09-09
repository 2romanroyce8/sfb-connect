"use client";

import { useState } from "react";
import { Calendar, CalendarDays, Bot, MessageSquare, Pause, Play, Check } from "lucide-react";

// This card IS the integrations interface -- not a banner sitting above one.
// Every value rendered below comes from the real Supabase connection rows
// and the real Google OAuth state passed in as props. No status here is
// ever hardcoded to "Connected" -- disconnected/not-yet-built integrations
// say so honestly, and their CTA is disabled rather than pretending a flow
// exists.

export type GoogleConnectionState = { email: string; connectedAt: string; valid: boolean } | null;
export type TeamConnectionRow = { repName: string; email: string | null; connectedAt: string; valid: boolean };
export type SimpleIntegrationState = { status: "Needs Setup" | "Disconnected"; description: string };

type TabId = "google_calendar" | "apple_calendar" | "ai_provider" | "messaging";

const STATUS_COLOR: Record<string, string> = {
  Connected: "#30D158",
  "Needs Setup": "#FFD60A",
  Disconnected: "#6E6E73",
  "Connection Issue": "#FF453A",
  "Not Connected": "#6E6E73",
};

export default function IntegrationControlDeck({
  google,
  teamConnections,
  isOwner,
  appleCalendar,
  aiProvider,
  messaging,
}: {
  google: GoogleConnectionState;
  teamConnections: TeamConnectionRow[];
  isOwner: boolean;
  appleCalendar: SimpleIntegrationState;
  aiProvider: SimpleIntegrationState;
  messaging: { name: string; status: "Needs Setup" | "Disconnected"; description: string }[];
}) {
  const [selected, setSelected] = useState<TabId>("google_calendar");
  const [animating, setAnimating] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const tabs: { id: TabId; label: string }[] = [
    { id: "google_calendar", label: "Google Calendar" },
    { id: "apple_calendar", label: "Apple Calendar" },
    { id: "ai_provider", label: "AI Provider" },
    { id: "messaging", label: "Messaging" },
  ];
  const selectedIndex = tabs.findIndex((t) => t.id === selected);

  async function disconnectGoogle() {
    setDisconnecting(true);
    try {
      await fetch("/api/team/integrations/google/disconnect", { method: "POST" });
      window.location.reload();
    } finally {
      setDisconnecting(false);
    }
  }

  const googleStatus = google ? (google.valid ? "Connected" : "Connection Issue") : "Not Connected";

  return (
    <div
      className="relative w-full mx-auto mb-10"
      style={{ maxWidth: 900 }}
    >
      {/* depth layer behind */}
      <div
        className="absolute rounded-[36px]"
        style={{ left: "1%", right: "-1%", top: 0, bottom: "-1.5%", background: "#0C0C0C", border: "1px solid rgba(255,255,255,0.08)", zIndex: 0 }}
      />

      {/* outer frame */}
      <div
        className="relative rounded-[34px]"
        style={{
          background: "linear-gradient(180deg, #121212 0%, #0E0E0E 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 26px 80px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.035)",
          zIndex: 1,
        }}
      >
        {/* inner card */}
        <div
          className="relative rounded-[30px] overflow-hidden m-[3%]"
          style={{
            background: "linear-gradient(180deg, #171717 0%, #111111 100%)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), 0 20px 60px rgba(0,0,0,0.25)",
          }}
        >
          {/* top progress / category navigation -- real tab switcher */}
          <div className="grid grid-cols-4 px-[7%] pt-[5%]" style={{ gap: 12 }}>
            {tabs.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                className="cursor-pointer"
                style={{
                  height: 3,
                  borderRadius: 999,
                  background: i <= selectedIndex ? "#F3F3F3" : "#4A4A4A",
                  transition: "background 0.2s ease",
                }}
                aria-label={`Show ${t.label}`}
                aria-current={selected === t.id}
              />
            ))}
          </div>

          {/* floating integration icons -- clickable selectors */}
          <div
            className="relative px-[7%]"
            style={{ height: 220, borderBottom: "1px solid rgba(103,79,255,0.22)" }}
          >
            <IconSelector
              tabId="google_calendar"
              selected={selected}
              onSelect={setSelected}
              animating={animating}
              delay="0s"
              style={{ left: "4%", top: "26%", width: 60, height: 60, borderRadius: 20, background: "linear-gradient(180deg, #4D4D4D 0%, #252525 100%)", border: "1px solid rgba(255,255,255,0.14)" }}
            >
              <Calendar size={26} className="text-white/90" strokeWidth={1.75} />
            </IconSelector>

            <IconSelector
              tabId="apple_calendar"
              selected={selected}
              onSelect={setSelected}
              animating={animating}
              delay="0.7s"
              style={{ left: "28%", top: "50%", width: 46, height: 46, borderRadius: 16, background: "#F2F2F2" }}
            >
              <CalendarDays size={20} className="text-[#6E6E73]" strokeWidth={1.9} />
            </IconSelector>

            <IconSelector
              tabId="ai_provider"
              selected={selected}
              onSelect={setSelected}
              animating={animating}
              delay="1.4s"
              style={{ left: "54%", top: "14%", width: 62, height: 62, borderRadius: 19, background: "#F2F2F2" }}
            >
              <Bot size={28} className="text-[#7A5CFF]" strokeWidth={1.75} />
            </IconSelector>

            <IconSelector
              tabId="messaging"
              selected={selected}
              onSelect={setSelected}
              animating={animating}
              delay="2.1s"
              style={{ right: "6%", top: "22%", width: 52, height: 52, borderRadius: 17, background: "linear-gradient(180deg, #A621EF 0%, #7A11C4 100%)" }}
            >
              <MessageSquare size={22} className="text-white" strokeWidth={1.9} />
            </IconSelector>

            {/* purple glow line at bottom of visual area */}
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{
                height: 1,
                background: "linear-gradient(90deg, transparent 0%, rgba(91,61,255,0.35) 35%, rgba(97,64,255,0.50) 55%, transparent 100%)",
                boxShadow: "0 0 18px rgba(93,65,255,0.22)",
              }}
            />
          </div>

          {/* dynamic detail panel for selected integration */}
          <div className="px-[7%] py-[6%]">
            {selected === "google_calendar" && (
              <>
                <PanelHeader title="Google Calendar" status={googleStatus} />
                {google ? (
                  <>
                    <p className="text-[14.5px] text-[#B4B4B6] mt-[10px]" style={{ letterSpacing: "-0.01em", lineHeight: 1.45 }}>
                      Connected as <span className="text-[#F5F5F7]">{google.email}</span> · Since {new Date(google.connectedAt).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
                      {["Read availability", "Create events", "Google Meet"].map((c) => (
                        <span key={c} className="inline-flex items-center gap-1.5 text-[12.5px] text-[#30D158]">
                          <Check size={13} strokeWidth={2.5} /> {c}
                        </span>
                      ))}
                    </div>

                    {isOwner && teamConnections.length > 0 && (
                      <div className="mt-6">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">
                          Team Connections
                        </div>
                        <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                          {teamConnections.map((c, i) => (
                            <div
                              key={i}
                              className="grid items-center gap-[18px] px-4"
                              style={{
                                height: 52,
                                gridTemplateColumns: "1fr 1.4fr auto",
                                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
                                background: "#0A0A0A",
                              }}
                            >
                              <span className="text-[13px] text-[#F5F5F7] truncate">{c.repName}</span>
                              <span className="text-[13px] text-[#A1A1A6] truncate">{c.email || "—"}</span>
                              <span className="inline-flex items-center gap-1.5 text-[11.5px] justify-self-end" style={{ color: c.valid ? STATUS_COLOR.Connected : STATUS_COLOR["Connection Issue"] }}>
                                <span className="w-[6px] h-[6px] rounded-full" style={{ background: c.valid ? STATUS_COLOR.Connected : STATUS_COLOR["Connection Issue"] }} />
                                {c.valid ? "Connected" : "Needs Reconnect"}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-[#6E6E73] mt-2 leading-relaxed">
                          You see who's connected and when — never the underlying Google tokens, which stay encrypted and server-side per rep.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[14.5px] text-[#B4B4B6] mt-[10px]" style={{ letterSpacing: "-0.01em", lineHeight: 1.45 }}>
                    Connect Google Calendar to check rep availability, create meetings, and automatically generate Google Meet links.
                  </p>
                )}

                {google ? (
                  <button
                    type="button"
                    onClick={disconnectGoogle}
                    disabled={disconnecting}
                    className="mt-6 flex items-center justify-center w-full transition-opacity disabled:opacity-60"
                    style={pillStyle("danger")}
                  >
                    <span className="text-[#FF453A] font-medium" style={{ fontSize: 16, letterSpacing: "-0.02em" }}>
                      {disconnecting ? "Disconnecting…" : "Disconnect Google Calendar"}
                    </span>
                  </button>
                ) : (
                  <a href="/api/team/integrations/google/connect" className="mt-6 flex items-center justify-center gap-2 w-full" style={pillStyle("default")}>
                    <span className="text-[#F3F3F3] font-medium" style={{ fontSize: 16, letterSpacing: "-0.02em" }}>Connect Google Calendar</span>
                    <span className="text-[#F3F3F3]" style={{ fontSize: 17 }}>→</span>
                  </a>
                )}
              </>
            )}

            {selected === "apple_calendar" && (
              <>
                <PanelHeader title="Apple Calendar" status={appleCalendar.status} />
                <p className="text-[14.5px] text-[#B4B4B6] mt-[10px]" style={{ letterSpacing: "-0.01em", lineHeight: 1.45 }}>
                  {appleCalendar.description}
                </p>
                <DisabledPill label="Not Available Yet" />
              </>
            )}

            {selected === "ai_provider" && (
              <>
                <PanelHeader title="AI Provider" status={aiProvider.status} />
                <p className="text-[14.5px] text-[#B4B4B6] mt-[10px]" style={{ letterSpacing: "-0.01em", lineHeight: 1.45 }}>
                  {aiProvider.description}
                </p>
                <DisabledPill label="Not Available Yet" />
              </>
            )}

            {selected === "messaging" && (
              <>
                <PanelHeader title="Messaging" status={null} />
                <p className="text-[14.5px] text-[#B4B4B6] mt-[10px] mb-4" style={{ letterSpacing: "-0.01em", lineHeight: 1.45 }}>
                  Send text reminders, confirmations, and follow-up emails from the CRM.
                </p>
                <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  {messaging.map((m, i) => (
                    <div key={m.name} className="flex items-center justify-between px-4 py-3" style={{ background: "#0A0A0A", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
                      <div>
                        <div className="text-[13.5px] text-[#F5F5F7]">{m.name}</div>
                        <div className="text-[11.5px] text-[#6E6E73] mt-0.5">{m.description}</div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] shrink-0 ml-3" style={{ color: STATUS_COLOR[m.status] }}>
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: STATUS_COLOR[m.status] }} />
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
                <DisabledPill label="Not Available Yet" />
              </>
            )}
          </div>
        </div>

        {/* floating pause/play control -- toggles icon animation only */}
        <button
          type="button"
          onClick={() => setAnimating((a) => !a)}
          className="absolute rounded-full flex items-center justify-center"
          aria-label={animating ? "Pause icon animation" : "Play icon animation"}
          style={{
            right: "6%",
            bottom: "3%",
            width: 52,
            height: 52,
            background: "radial-gradient(circle at 45% 35%, #4A4A4C 0%, #2C2C2F 56%, #1E1738 100%)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 18px 36px rgba(0,0,0,0.35)",
            zIndex: 10,
          }}
        >
          {animating ? (
            <Pause size={17} className="text-[#F0F0F0]" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={17} className="text-[#F0F0F0]" fill="currentColor" strokeWidth={0} />
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes integrationsFloat {
          0% { transform: translateY(-3px); }
          50% { transform: translateY(3px); }
          100% { transform: translateY(-3px); }
        }
        .integrations-float {
          animation: integrationsFloat 8s ease-in-out infinite;
        }
        .integrations-float.paused {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

function IconSelector({
  tabId,
  selected,
  onSelect,
  animating,
  delay,
  style,
  children,
}: {
  tabId: TabId;
  selected: TabId;
  onSelect: (t: TabId) => void;
  animating: boolean;
  delay: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  const isActive = selected === tabId;
  return (
    <button
      type="button"
      onClick={() => onSelect(tabId)}
      className={`absolute rounded-[20px] flex items-center justify-center integrations-float ${animating ? "" : "paused"} transition-all duration-200`}
      style={{
        ...style,
        border: (style.background as string)?.includes("#F2F2F2") ? "1px solid rgba(0,0,0,0.06)" : (style.border as string) || "1px solid rgba(255,255,255,0.14)",
        boxShadow: isActive ? "0 0 0 2px rgba(255,255,255,0.55), 0 16px 34px rgba(0,0,0,0.35)" : "0 16px 34px rgba(0,0,0,0.30)",
        opacity: isActive ? 1 : 0.55,
        transform: `${isActive ? "scale(1.08)" : "scale(1)"} rotate(-4deg)`,
        animationDelay: delay,
        cursor: "pointer",
      }}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
}

function PanelHeader({ title, status }: { title: string; status: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className="font-medium text-[#F4F4F4]" style={{ fontSize: 26, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
        {title}
      </div>
      {status && (
        <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: STATUS_COLOR[status] }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: STATUS_COLOR[status] }} />
          {status}
        </span>
      )}
    </div>
  );
}

function DisabledPill({ label }: { label: string }) {
  return (
    <div
      className="mt-6 flex items-center justify-center w-full select-none"
      style={{ ...pillStyle("disabled"), cursor: "not-allowed" }}
      aria-disabled="true"
    >
      <span className="text-[#5C5C5F] font-medium" style={{ fontSize: 16, letterSpacing: "-0.02em" }}>{label}</span>
    </div>
  );
}

function pillStyle(kind: "default" | "danger" | "disabled"): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 56,
    borderRadius: 40,
    background: "linear-gradient(180deg, #262626 0%, #1D1D1D 100%)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 28px rgba(0,0,0,0.22)",
  };
  if (kind === "danger") return { ...base, border: "1px solid rgba(255,69,58,0.28)" };
  if (kind === "disabled") return { ...base, opacity: 0.55 };
  return base;
}
