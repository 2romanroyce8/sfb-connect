"use client";

import { useMemo, useState } from "react";
import { UserRoundPlus, UserRound, Building2, Search, ChevronDown, X, Loader2 } from "lucide-react";

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  team_role: "owner" | "sales_rep";
  team_status: "invited" | "active" | "disabled" | null;
};

const ROLE_LABEL: Record<string, string> = { owner: "Owner", sales_rep: "Sales Rep" };

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function initials(m: Member) {
  const source = m.full_name || [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
  return source.slice(0, 1).toUpperCase();
}

function RoleSelect({ value, onChange, disabled }: { value: string; onChange: (role: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between disabled:opacity-50"
        style={{ width: 124, height: 40, background: "#3A3A3A", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "0 13px", fontSize: 14, fontWeight: 500, color: "#F2F2F2" }}
      >
        {ROLE_LABEL[value]}
        <ChevronDown size={16} style={{ color: "#858585" }} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 z-20" style={{ background: "#2C2C2C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, boxShadow: "0 16px 38px rgba(0,0,0,0.32)", padding: 6, width: 140 }}>
          {["owner", "sales_rep"].map((r) => (
            <button
              key={r}
              onClick={() => {
                onChange(r);
                setOpen(false);
              }}
              className="w-full text-left"
              style={{ height: 36, padding: "0 10px", borderRadius: 8, fontSize: 14, color: "#DCDCDC", background: value === r ? "#393939" : "transparent" }}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InviteCollaboratorsModal({
  members,
  onClose,
  onChanged,
}: {
  members: Member[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"team" | "departments">("team");
  const [query, setQuery] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("sales_rep");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.toLowerCase();
    return members.filter((m) => (m.full_name || "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members, query]);

  const showInviteRow = isValidEmail(query) && filtered.length === 0;

  async function changeRole(userId: string, role: string) {
    setBusyId(userId);
    try {
      const res = await fetch("/api/team/change-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change role.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendInvite() {
    setInviting(true);
    setError(null);
    try {
      const [firstName, ...rest] = inviteName.trim().split(" ");
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: query.trim(), role: inviteRole, firstName: firstName || undefined, lastName: rest.join(" ") || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuery("");
      setInviteName("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.58)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 496,
          maxWidth: "calc(100vw - 40px)",
          minHeight: 497,
          background: "#232323",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 32,
          boxShadow: "0 28px 75px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.025)",
          padding: "28px 28px 24px",
          color: "#F4F4F4",
          fontFamily: "Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif",
          position: "relative",
        }}
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-[#7C7C7C] hover:text-white">
          <X size={16} />
        </button>

        <div
          className="flex items-center justify-center"
          style={{ width: 67, height: 67, borderRadius: 16, background: "#363636", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}
        >
          <UserRoundPlus size={37} color="#FFFFFF" />
        </div>

        <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", color: "#F5F5F5" }}>Invite collaborators</div>
        <div style={{ fontSize: 15, fontWeight: 400, color: "#8E8E8E", marginTop: 3, marginBottom: 24 }}>Invite team members to work inside SFB Connect</div>

        <div className="grid grid-cols-2" style={{ height: 45, background: "#333333", borderRadius: 12, padding: 3, marginBottom: 20, gap: 0 }}>
          {[
            { key: "team", label: "Team members", icon: UserRound },
            { key: "departments", label: "Departments", icon: Building2 },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className="flex items-center justify-center gap-1.5"
              style={{
                borderRadius: 10,
                background: tab === t.key ? "#3C3C3C" : "transparent",
                color: tab === t.key ? "#F5F5F5" : "#8B8B8B",
                fontSize: 15,
                fontWeight: tab === t.key ? 500 : 400,
                boxShadow: tab === t.key ? "0 2px 8px rgba(0,0,0,0.16)" : "none",
              }}
            >
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </div>

        <div style={{ height: 1, width: "100%", background: "rgba(255,255,255,0.06)", margin: "0 0 20px" }} />

        {tab === "departments" ? (
          <div className="text-[13.5px] text-[#8E8E8E] text-center mt-10">Departments aren't set up for SFB Connect yet.</div>
        ) : (
          <>
            <div className="flex items-center" style={{ width: "100%", height: 46, background: "#333333", border: "1px solid rgba(255,255,255,0.025)", borderRadius: 12, padding: "0 14px", marginBottom: 18 }}>
              <Search size={18} color="#C7C7C7" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email or role..."
                className="w-full bg-transparent outline-none"
                style={{ height: "100%", fontSize: 15, color: "#ECECEC", paddingLeft: 10 }}
              />
            </div>

            <div style={{ fontSize: 14, fontWeight: 400, color: "#9B9B9B", marginBottom: 12 }}>Team members</div>

            {error && <p className="text-[12.5px] text-[#FF453A] mb-3">{error}</p>}

            <div className="flex flex-col" style={{ gap: 14, maxHeight: 260, overflowY: "auto" }}>
              {filtered.length === 0 && !showInviteRow && <div className="text-[13px] text-[#7C7C7C]">No team members found</div>}

              {filtered.map((m) => (
                <div key={m.id} className="grid items-center" style={{ height: 44, gridTemplateColumns: "42px 1fr 124px", gap: 10 }}>
                  <div className="rounded-full flex items-center justify-center" style={{ width: 40, height: 40, background: "#333333", color: "#F0F0F0", fontSize: 13, fontWeight: 600 }}>
                    {initials(m)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: 14.5, fontWeight: 500, color: "#F0F0F0" }}>
                      {m.full_name || m.email}
                    </div>
                    <div className="truncate" style={{ fontSize: 12, color: "#8D8D8D", marginTop: 2 }}>
                      {m.email}
                    </div>
                  </div>
                  {busyId === m.id ? (
                    <Loader2 size={16} className="animate-spin text-[#8B8B8B] justify-self-end" />
                  ) : (
                    <RoleSelect value={m.team_role} onChange={(role) => changeRole(m.id, role)} />
                  )}
                </div>
              ))}

              {showInviteRow && (
                <div style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                  <div className="text-[13px] text-[#F0F0F0] mb-2 truncate">{query.trim()}</div>
                  <input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Name (optional)"
                    className="w-full outline-none mb-2"
                    style={{ height: 34, borderRadius: 8, padding: "0 10px", fontSize: 12.5, background: "#222222", border: "1px solid rgba(255,255,255,0.06)", color: "#F0F0F0" }}
                  />
                  <div className="flex items-center gap-2">
                    <RoleSelect value={inviteRole} onChange={setInviteRole} />
                    <button
                      onClick={sendInvite}
                      disabled={inviting}
                      className="flex-1 disabled:opacity-60"
                      style={{ height: 36, background: "#F2F2F2", color: "#111111", borderRadius: 10, fontWeight: 600, fontSize: 13 }}
                    >
                      {inviting ? "Inviting…" : "Invite"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
