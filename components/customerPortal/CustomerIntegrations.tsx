"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { key: string; name: string; description: string; logo: string | null; status: "live" | "needs_setup" | "planned"; configured: boolean; connected: { account_label: string | null; connected_at: string; status: "active" | "error"; last_error: string | null } | null };

/**
 * Customer-side integrations: the same OAuth flows the team uses, scoped to
 * the signed-in customer's own account. A client connecting here is what
 * flips a provider to Live in the registry (first successful connection by
 * anyone). Sandbox (trial) businesses see the list but cannot connect.
 */
export default function CustomerIntegrations({ isSandbox }: { isSandbox: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/dashboard/integrations", { cache: "no-store" });
    if (!r.ok) { setErr("Could not load integrations."); return; }
    const j = await r.json(); setItems(j.items); setErr(null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const flash = params.get("connected") ? { ok: true, text: `Connected ${params.get("connected")}.` } : params.get("error") ? { ok: false, text: decodeURIComponent(params.get("error")!) } : null;

  const disconnect = async (key: string, name: string) => {
    if (!confirm(`Disconnect ${name}? Your agent stops using it immediately.`)) return;
    await fetch(`/api/team/integrations/${key}/disconnect`, { method: "POST" }); await load();
  };

  if (!items) return <div className="text-[13px] text-neutral-500">{err ?? "Loading…"}</div>;
  return (
    <div className="flex flex-col gap-3">
      {flash && <div className={`rounded-xl px-4 py-3 text-[13px] ${flash.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{flash.text}</div>}
      {isSandbox && <div className="rounded-xl px-4 py-3 text-[13px] bg-amber-50 text-amber-900 border border-amber-200">Integrations connect on Solo and Agency. The trial runs on demo data with no real connections or sends.</div>}
      {items.map((i) => (
        <div key={i.key} className="border border-neutral-200 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {i.logo ? <img src={i.logo} alt="" className="w-9 h-9 object-contain shrink-0 rounded-md bg-neutral-50 p-1" /> : <span className="w-9 h-9 rounded-md bg-neutral-100 shrink-0" />}
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-neutral-900">{i.name}</div>
              <div className="text-[12.5px] text-neutral-500 mt-0.5">{i.description}</div>
              {i.connected && <div className="text-[12px] mt-1 text-emerald-700">Connected{i.connected.account_label ? ` as ${i.connected.account_label}` : ""} · {new Date(i.connected.connected_at).toLocaleDateString()}{i.connected.status === "error" && <span className="text-red-600"> · needs reconnect</span>}</div>}
              {!i.configured && !i.connected && <div className="text-[12px] mt-1 text-neutral-400">Coming soon — SFB Connect is finishing setup with {i.name}.</div>}
            </div>
          </div>
          <div className="shrink-0">
            {i.connected ? (
              <button onClick={() => disconnect(i.key, i.name)} className="text-[12.5px] font-medium text-red-600 border border-red-200 rounded-full px-3 py-1.5">Disconnect</button>
            ) : i.configured && !isSandbox ? (
              <a href={`/api/team/integrations/${i.key}/connect?return=dashboard`} className="text-[12.5px] font-semibold text-white bg-neutral-900 rounded-full px-4 py-2 inline-block">Connect</a>
            ) : (
              <span className="text-[12.5px] text-neutral-400 border border-neutral-200 rounded-full px-3 py-1.5 inline-block">{isSandbox ? "Paid plans" : "Soon"}</span>
            )}
          </div>
        </div>
      ))}
      <p className="text-[12px] text-neutral-400 mt-2">Your agent only acts inside connected accounts within tasks you approve. Tokens are stored encrypted and never shown.</p>
    </div>
  );
}
