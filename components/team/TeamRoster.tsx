"use client";

import { useState } from "react";
import { UserPlus, RotateCcw, KeyRound, Power } from "lucide-react";

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  team_role: "owner" | "sales_rep";
  team_status: "invited" | "active" | "disabled" | null;
  invited_at: string | null;
  activated_at: string | null;
  last_active_at: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  invited: "#FFD60A",
  active: "#30D158",
  disabled: "#FF453A",
};

async function callAction(action: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/team/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"sales_rep" | "owner">("sales_rep");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await callAction("invite", { firstName, lastName, email, role });
      setFirstName("");
      setLastName("");
      setEmail("");
      setOpen(false);
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold"
      >
        <UserPlus size={14} /> Invite Team Member
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 rounded-[14px] mb-2 flex flex-col gap-3"
      style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="grid grid-cols-2 gap-3">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none"
          style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none"
          style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        />
      </div>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none"
        style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "sales_rep" | "owner")}
        className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none"
        style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
      >
        <option value="sales_rep">Sales Rep</option>
        <option value="owner">Owner</option>
      </select>
      {error && <p className="text-[12.5px] text-[#FF453A]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="h-[36px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-60"
        >
          {loading ? "Sending invite…" : "Send Invite"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-[#A1A1A6]"
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function TeamRoster({ members: initialMembers }: { members: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function refresh() {
    window.location.reload();
  }

  async function handleAction(action: string, userId: string, successMsg: string) {
    setBusyId(userId);
    try {
      await callAction(action, { userId });
      setToast(successMsg);
      if (action === "deactivate" || action === "activate") {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === userId
              ? { ...m, team_status: action === "deactivate" ? "disabled" : "active" }
              : m
          )
        );
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusyId(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="px-8 py-8 max-w-[1100px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Team</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">
            Manage who has access to the Sales OS.
          </div>
        </div>
        <InviteForm onInvited={refresh} />
      </div>

      {toast && (
        <div className="mb-4 text-[12.5px] text-[#F5F5F7] bg-[#151515] border border-white/10 rounded-[8px] px-3 py-2">
          {toast}
        </div>
      )}

      <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: "#0A0A0A" }}>
              {["Name", "Email", "Role", "Status", "Last Active", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td className="px-4 py-3 text-[#F5F5F7]">
                  {m.full_name || [m.first_name, m.last_name].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-3 text-[#A1A1A6]">{m.email}</td>
                <td className="px-4 py-3 text-[#A1A1A6] capitalize">{m.team_role.replace("_", " ")}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-[6px] h-[6px] rounded-full"
                      style={{ background: STATUS_COLOR[m.team_status || "invited"] }}
                    />
                    <span className="capitalize text-[#A1A1A6]">{m.team_status || "invited"}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-[#6E6E73]">
                  {m.last_active_at ? new Date(m.last_active_at).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {m.team_status === "invited" && (
                      <button
                        disabled={busyId === m.id}
                        onClick={() => handleAction("resend-invite", m.id, "Invite resent.")}
                        title="Resend invite"
                        className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    <button
                      disabled={busyId === m.id}
                      onClick={() => handleAction("reset-access", m.id, "Password reset email sent.")}
                      title="Reset access"
                      className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]"
                    >
                      <KeyRound size={14} />
                    </button>
                    <button
                      disabled={busyId === m.id}
                      onClick={() =>
                        handleAction(
                          m.team_status === "disabled" ? "activate" : "deactivate",
                          m.id,
                          m.team_status === "disabled" ? "Account reactivated." : "Account disabled."
                        )
                      }
                      title={m.team_status === "disabled" ? "Reactivate" : "Deactivate"}
                      className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]"
                    >
                      <Power size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
