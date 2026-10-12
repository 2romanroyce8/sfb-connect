"use client";

import { useCallback, useEffect, useState } from "react";

type Gate = { status: "not_started" | "email_submitted" | "cleared" | "connected"; email: string | null; canConnect: boolean; waitingCopy: string; submittedAt: string | null };

/**
 * The Google "never blocked" gate (Roman, 2026-10-12). The Connect button does
 * not exist until the team has cleared the customer's address on Google's
 * tester list. Renders the email form → waiting state → the real button.
 * `connectHref` is the OAuth start URL; `label` the button text.
 */
export default function GoogleGate({ connectHref, label, connected, account, onConnected, dark = false }: { connectHref: string; label: string; connected: boolean; account: string | null; onConnected?: React.ReactNode; dark?: boolean }) {
  const [g, setG] = useState<Gate | null>(null); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/dashboard/google-gate", { cache: "no-store" }); if (r.ok) { const j = (await r.json()) as Gate; setG(j); if (j.email) setEmail(j.email); } }, []);
  useEffect(() => { void load(); }, [load]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const r = await fetch("/api/dashboard/google-gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json(); setBusy(false); if (!r.ok) { setErr(j.error || "Could not save."); return; } setG((x) => ({ ...(x ?? j), ...j }));
  };
  const text = dark ? "text-white/[0.65]" : "text-neutral-600"; const sub = dark ? "text-white/[0.45]" : "text-neutral-500";
  const input = dark ? "h-[42px] rounded-lg px-3 text-[14px] outline-none bg-[#0F0F0F] border border-white/[0.12] text-white" : "h-[42px] rounded-lg border border-neutral-300 px-3 text-[14px] outline-none focus:border-neutral-900";
  const btn = dark ? "h-[42px] px-5 rounded-full bg-white text-black text-[14px] font-semibold disabled:opacity-60" : "h-[42px] px-5 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60";

  if (connected) return <>{onConnected ?? <span className="inline-flex items-center gap-2 text-[13.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">✓ Connected{account ? ` as ${account}` : ""}</span>}</>;
  if (!g) return <div className={`text-[13px] ${sub}`}>Checking your Google clearance…</div>;
  if (g.canConnect) return <a href={connectHref} className={`${btn} inline-flex items-center`}>{label}</a>;
  if (g.status === "email_submitted") return (
    <div className={`rounded-xl p-4 ${dark ? "bg-white/[0.04] border border-white/[0.1]" : "bg-amber-50 border border-amber-200"}`}>
      <div className={`text-[14px] font-medium ${dark ? "text-white" : "text-amber-900"}`}>{g.waitingCopy}</div>
      <div className={`text-[12.5px] mt-1 ${sub}`}>Address on file: <span className="font-mono">{g.email}</span>{g.submittedAt ? ` · submitted ${new Date(g.submittedAt).toLocaleString()}` : ""}. Wrong address? Enter the right one below.</div>
      <form onSubmit={submit} className="mt-3 flex gap-2 flex-wrap"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} flex-1 min-w-[220px]`} /><button type="submit" disabled={busy} className={dark ? "h-[42px] px-4 rounded-full border border-white/[0.2] text-white text-[13px]" : "h-[42px] px-4 rounded-full border border-neutral-300 text-[13px] font-medium"}>{busy ? "Saving…" : "Update address"}</button></form>
      {err && <div className="text-[12.5px] text-red-600 mt-2">{err}</div>}
    </div>
  );
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className={`text-[13.5px] ${text}`}>First, tell us which Google account you&apos;ll connect. We clear it on our side (usually within a few hours) and notify you the moment the Connect button is live — so you never hit a Google error.</div>
      <div className="flex gap-2 flex-wrap"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com or you@yourbusiness.com" className={`${input} flex-1 min-w-[240px]`} /><button type="submit" disabled={busy} className={btn}>{busy ? "Saving…" : "Clear my account"}</button></div>
      {err && <div className="text-[12.5px] text-red-600">{err}</div>}
    </form>
  );
}
