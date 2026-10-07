"use client";

import { useCallback, useEffect, useState } from "react";
import { describeScope } from "@/lib/agent/scopes";

type Authz = { id: string; authorized_by?: string | null; client_id: string; client_name: string; workspace_label: string; scopes: string[]; status: "active" | "revoked"; created_at: string; last_used_at: string | null; revoked_at: string | null; revoked_reason: string | null };
type Audit = { id: number; authorization_id: string | null; client_id: string | null; access_method: string; action: string; resource: string | null; result: string; created_at: string };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");

export default function ConnectedAgentsSection() {
  const [auths, setAuths] = useState<Authz[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/agents", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not load connected agents");
      setAuths(j.authorizations ?? []);
      setAudit(j.audit ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load connected agents");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const revoke = async (a: Authz) => {
    if (!confirm(`Revoke ${a.client_name}'s access? Its API tokens and any open browser sessions stop working immediately.`)) return;
    setBusy(a.id);
    try {
      const res = await fetch(`/api/team/agents/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Revoke failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(null);
    }
  };

  const active = auths.filter((a) => a.status === "active");
  const revoked = auths.filter((a) => a.status !== "active");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-[#A1A1A6]">
        AI agents (Hyperagent, Muse, …) connect through OAuth and act as <span className="text-[#F5F5F7]">you</span>, read-only, under the same permissions you have. They never receive your password. Agents connect by pointing at <span className="font-mono text-[11px] text-[#F5F5F7]">{typeof window !== "undefined" ? window.location.origin : ""}/api/v1/agent/mcp</span>.
      </p>
      {error && <div className="text-[12px] text-[#FF9F9A]">{error}</div>}
      {loading ? (
        <div className="text-[12px] text-[#6E6E73]">Loading…</div>
      ) : active.length === 0 ? (
        <div className="text-[12.5px] text-[#6E6E73]">No agents are connected to your account. Owners also see agents authorized by other team members here.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((a) => (
            <li key={a.id} className="rounded-[10px] p-3" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-[#F5F5F7]">{a.client_name} <span className="ml-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "rgba(48,209,88,0.12)", color: "#30D158" }}>read-only</span></div>
                  <div className="text-[11.5px] text-[#6E6E73] mt-0.5">{a.authorized_by ? <>Authorized by <span className="text-[#A1A1A6]">{a.authorized_by}</span> · </> : null}Connected {fmt(a.created_at)} · last used {fmt(a.last_used_at)} · {a.workspace_label}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.scopes.map((s) => (
                      <span key={s} title={s} className="text-[11px] px-2 py-0.5 rounded-full text-[#A1A1A6]" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>{describeScope(s)}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => revoke(a)} disabled={busy === a.id} className="h-[30px] px-3 rounded-[8px] text-[12px] font-semibold disabled:opacity-60" style={{ background: "rgba(255,69,58,0.12)", color: "#FF6961", border: "1px solid rgba(255,69,58,0.3)" }}>
                  {busy === a.id ? "Revoking…" : "Revoke"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {revoked.length > 0 && (
        <div className="text-[11.5px] text-[#6E6E73]">
          {revoked.length} revoked: {revoked.slice(0, 5).map((a) => `${a.client_name} (${fmt(a.revoked_at)}${a.revoked_reason ? `, ${a.revoked_reason.replace(/_/g, " ")}` : ""})`).join("; ")}
        </div>
      )}
      <button onClick={() => setShowLog((v) => !v)} className="self-start text-[12px] text-[#A1A1A6] underline underline-offset-2">
        {showLog ? "Hide" : "Show"} agent activity log ({audit.length})
      </button>
      {showLog && (
        <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[11.5px]">
            <thead><tr className="text-left text-[#6E6E73]" style={{ background: "#101010" }}><th className="px-2 py-1.5 font-medium">When</th><th className="px-2 py-1.5 font-medium">Agent</th><th className="px-2 py-1.5 font-medium">Via</th><th className="px-2 py-1.5 font-medium">Action</th><th className="px-2 py-1.5 font-medium">Resource</th><th className="px-2 py-1.5 font-medium">Result</th></tr></thead>
            <tbody>
              {audit.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <td className="px-2 py-1 text-[#A1A1A6] whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="px-2 py-1 text-[#F5F5F7]">{r.client_id ?? "—"}</td>
                  <td className="px-2 py-1 text-[#A1A1A6]">{r.access_method}</td>
                  <td className="px-2 py-1 font-mono text-[#F5F5F7]">{r.action}</td>
                  <td className="px-2 py-1 text-[#A1A1A6] max-w-[220px] truncate">{r.resource ?? ""}</td>
                  <td className="px-2 py-1" style={{ color: r.result === "success" ? "#30D158" : r.result === "denied" ? "#FFD60A" : "#FF6961" }}>{r.result}</td>
                </tr>
              ))}
              {audit.length === 0 && <tr><td colSpan={6} className="px-2 py-2 text-[#6E6E73]">No agent activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
