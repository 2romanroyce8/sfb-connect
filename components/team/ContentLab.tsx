"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ExternalLink, Plus, X, Radar, Sparkles, Settings2, Scissors, Send, AlertTriangle } from "lucide-react";

// Content Lab — Rome's content autopilot. Phase 1 (live): Trend Radar + Pattern Analyzer (read-only).
// Phase 2 (Clip Factory) and Phase 3 (auto-edit + Publish Queue) are not built yet.
const card: React.CSSProperties = { background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" };
const input: React.CSSProperties = { background: "var(--hx-101010)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
const HOOK_LABEL: Record<string, string> = { question: "Question", number_list: "Number / list", contrarian: "Contrarian", how_to: "How-to", curiosity_gap: "Curiosity gap", pov: "POV", build_story: "Build story", result_claim: "Result claim", statement: "Statement" };
const CTA_LABEL: Record<string, string> = { comment_keyword: "Comment keyword", save: "Save", follow: "Follow", share: "Share", link_in_bio: "Link in bio", dm: "DM", none: "No CTA" };
const FORMAT_LABEL: Record<string, string> = { reel: "Reel", carousel: "Carousel", image: "Image", unknown: "Unknown" };
const FORMAT_TAGS = [["", "Tag format…"], ["talking_head", "Talking head"], ["screen_recording", "Screen recording"], ["text_overlay", "Text overlay"], ["other", "Other"]];
const n = (x: number | null | undefined) => (x == null ? "—" : x >= 10000 ? `${Math.round(x / 1000)}k` : x >= 1000 ? `${(x / 1000).toFixed(1)}k` : String(Math.round(x * 10) / 10));
const ago = (iso: string | null) => { if (!iso) return "—"; const h = (Date.now() - Date.parse(iso)) / 3600e3; return h < 1 ? "<1h ago" : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "never");

type Post = { id: string; username: string | null; permalink: string | null; caption: string | null; hook: string; hook_type: string; cta_kind: string; cta_keyword: string | null; format: string; format_tag: string | null; like_count: number | null; comments_count: number | null; velocity: number | null; posted_at: string | null; niche: string | null; source: string; source_key: string | null; hashtags: string[]; why?: string[] };
type Group = { key: string; label: string; n: number; medianVelocity: number | null; medianComments: number | null; enough: boolean; lift: number | null; example: { hook: string; permalink: string | null; username: string | null } | null };
type Data = { setupNeeded: boolean; message?: string; niches: { name: string; hashtags: string[] }[]; igUsername: string | null; lastRefreshAt: string | null; lastResult: { status: string; message: string; accounts: { username: string; posts: number; error?: string }[]; hashtags: { tag: string; posts: number; error?: string }[]; blockedHashtags: string[] } | null; meta: { status: string; label: string | null; instagram?: boolean } | null; accounts: { id: string; username: string; niche: string | null; active: boolean; last_error: string | null }[]; days: number; radar: Post[]; own: Post[]; patterns: { total: number; byHook: Group[]; byCta: Group[]; byFormat: Group[]; byHour: Group[]; hashtags: { tag: string; inTop: number; topShare: number }[]; ctaKeywords: { keyword: string; n: number; medianComments: number | null }[]; testable: { key: string; label: string; evidence: string; suggestion: string; measurable: boolean }[]; overallMedianVelocity: number | null }; principle: string; hashtagBudget: { used: number; cap: number } };

function Pill({ children, tone }: { children: React.ReactNode; tone?: string }) { return <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ color: tone ?? "var(--hx-a1a1a6)", border: `1px solid ${tone ? `color-mix(in srgb, ${tone} 40%, transparent)` : "rgb(var(--w) / 0.12)"}` }}>{children}</span>; }

function GroupTable({ title, metric, groups }: { title: string; metric: "velocity" | "comments"; groups: Group[] }) {
  return (
    <div className="rounded-[12px] overflow-hidden" style={card}>
      <div className="px-4 py-3 text-[13px] font-semibold text-[color:var(--hx-f5f5f7)]">{title}</div>
      {groups.length === 0 ? <div className="px-4 pb-4 text-[12.5px] text-[color:var(--hx-6e6e73)]">No data yet.</div> : (
        <table className="w-full text-[12.5px]"><tbody>{groups.slice(0, 8).map((g) => (
          <tr key={g.key} style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }} className={g.enough ? "" : "opacity-50"}>
            <td className="px-4 py-2 text-[color:var(--hx-f5f5f7)]">{g.label}{!g.enough && <span className="ml-1 text-[10.5px] text-[color:var(--hx-6e6e73)]">(small sample)</span>}</td>
            <td className="px-2 py-2 text-[color:var(--hx-6e6e73)] text-right">n={g.n}</td>
            <td className="px-2 py-2 text-right text-[color:var(--hx-a1a1a6)]">{metric === "velocity" ? `${n(g.medianVelocity)}/h` : `${n(g.medianComments)} comments`}</td>
            <td className="px-4 py-2 text-right font-semibold" style={{ color: g.lift != null && g.lift >= 1.2 ? "var(--hx-30d158)" : g.lift != null && g.lift < 0.8 ? "var(--hx-ff453a)" : "var(--hx-a1a1a6)" }}>{g.lift != null ? `${g.lift}×` : ""}</td>
          </tr>))}</tbody></table>
      )}
    </div>
  );
}

export default function ContentLab() {
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"radar" | "patterns" | "setup" | "clips" | "publish">("radar");
  const [days, setDays] = useState(7); const [niche, setNiche] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  const [acct, setAcct] = useState({ username: "", niche: "" }); const [nicheDraft, setNicheDraft] = useState("");

  const load = useCallback(async () => { try { const r = await fetch(`/api/team/content-lab?days=${days}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not load."); setD(j); if (j.niches) setNicheDraft(j.niches.map((x: { name: string; hashtags: string[] }) => `${x.name}: ${x.hashtags.map((t) => `#${t}`).join(" ")}`).join("\n")); } catch (e) { setErr(e instanceof Error ? e.message : "Could not load."); } }, [days]);
  useEffect(() => { void load(); }, [load]);
  const post = async (body: Record<string, unknown>, key: string) => { setBusy(key); setErr(null); try { const r = await fetch("/api/team/content-lab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Failed."); await load(); return j; } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); return null; } finally { setBusy(null); } };

  const radar = useMemo(() => (d?.radar ?? []).filter((p) => !niche || p.niche === niche), [d, niche]);
  const niches = d?.niches?.map((x) => x.name) ?? [];

  const tabs = [["radar", "Trend Radar", Radar], ["patterns", "Patterns", Sparkles], ["setup", "Setup", Settings2], ["clips", "Clip Factory", Scissors], ["publish", "Publish Queue", Send]] as const;

  return (
    <div className="px-8 py-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">Content Lab</h1>
          <p className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">What&apos;s working in your niches, ranked by velocity (likes + comments per hour), and the patterns behind it. Read-only — nothing posts from here.</p>
        </div>
        {d && !d.setupNeeded && <div className="flex items-center gap-2 text-[12px] text-[color:var(--hx-6e6e73)]">Last refresh {fmt(d.lastRefreshAt)}<button type="button" onClick={() => void post({ action: "refresh" }, "refresh")} disabled={busy === "refresh"} className="inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-full text-[12.5px] font-semibold disabled:opacity-50" style={{ background: "rgb(var(--w))", color: "rgb(var(--k))" }}><RefreshCw size={13} className={busy === "refresh" ? "animate-spin" : ""} /> {busy === "refresh" ? "Refreshing…" : "Refresh now"}</button></div>}
      </div>

      <div className="inline-flex flex-wrap gap-1 p-1 rounded-full self-start" style={{ background: "rgb(var(--w) / 0.06)", border: "1px solid rgb(var(--w) / 0.1)" }}>
        {tabs.map(([k, label, Icon]) => <button key={k} type="button" onClick={() => setTab(k)} className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-full text-[12.5px] font-semibold" style={{ background: tab === k ? "rgb(var(--w))" : "transparent", color: tab === k ? "rgb(var(--k))" : "var(--hx-a1a1a6)" }}><Icon size={13} />{label}{(k === "clips" || k === "publish") && <span className="text-[10px] opacity-70">soon</span>}</button>)}
      </div>

      {err && <div className="rounded-[10px] px-4 py-3 text-[13px] text-[color:var(--hx-ff453a)]" style={{ background: "rgba(255,69,58,0.08)" }}>{err}</div>}
      {!d ? <div className="text-[13px] text-[color:var(--hx-6e6e73)]">Loading…</div> : d.setupNeeded ? (
        <div className="rounded-[12px] p-6 text-[13px] text-[color:var(--hx-a1a1a6)]" style={card}><AlertTriangle size={15} className="inline mr-2 text-[color:var(--hx-ffd60a)]" />{d.message}</div>
      ) : (
        <>
          {!d.meta?.instagram && (
            <div className="rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3 text-[12.5px]" style={card}>
              <div className="text-[color:var(--hx-a1a1a6)]"><b className="text-[color:var(--hx-f5f5f7)]">Step 2: connect Instagram.</b> Uses the same Meta app, asking only for Instagram read access. Needs the Instagram product added in the Meta app and the redirect URI <code>https://www.sfbconnect.com/api/team/integrations/meta_instagram/callback</code> registered.</div>
              <a href="/api/team/integrations/meta_instagram/connect" className="inline-flex items-center h-[34px] px-4 rounded-full text-[12.5px] font-semibold" style={{ background: "rgb(var(--w))", color: "rgb(var(--k))" }}>Connect Instagram</a>
            </div>
          )}
          {(!d.meta || d.lastResult?.status === "not_connected" || d.lastResult?.status === "no_ig_account") && (
            <div className="rounded-[12px] p-4 text-[12.5px] leading-relaxed" style={{ ...card, borderColor: "rgb(var(--hx-ffd60ac, 255 214 10) / 0.35)" }}>
              <div className="font-semibold text-[color:var(--hx-f5f5f7)] mb-1">Connect Instagram to start the radar</div>
              <div className="text-[color:var(--hx-a1a1a6)]">{d.lastResult?.message || "Meta isn't connected."} Go to <a href="/team/integrations" className="underline">Integrations → Meta</a> and connect (or reconnect) with the Facebook login that manages your Instagram professional account. The Meta app needs the Instagram Graph API product; hashtag tracking also needs Meta&apos;s &ldquo;Instagram Public Content Access&rdquo; feature. Competitor accounts work without it.</div>
            </div>
          )}

          {tab === "radar" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <select value={niche} onChange={(e) => setNiche(e.target.value)} className="h-[32px] rounded-[8px] px-2" style={input}><option value="">All niches</option>{niches.map((x) => <option key={x}>{x}</option>)}</select>
                <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-[32px] rounded-[8px] px-2" style={input}>{[1, 3, 7, 14, 30].map((x) => <option key={x} value={x}>Posted in last {x}d</option>)}</select>
                <span className="text-[color:var(--hx-6e6e73)]">{radar.length} posts · ranked by velocity, not totals</span>
              </div>
              {radar.length === 0 ? <div className="rounded-[12px] p-8 text-center text-[13px] text-[color:var(--hx-6e6e73)]" style={card}>No posts yet. Add competitor accounts in Setup, then Refresh now.</div> : radar.slice(0, 60).map((p, i) => (
                <article key={p.id} className="rounded-[12px] p-4 flex gap-4" style={card}>
                  <div className="w-[44px] shrink-0 text-center"><div className="text-[22px] font-semibold text-[color:var(--hx-f5f5f7)] leading-none">{i + 1}</div><div className="text-[10.5px] text-[color:var(--hx-6e6e73)] mt-1">{n(p.velocity)}/h</div></div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="text-[14px] font-semibold text-[color:var(--hx-f5f5f7)]">&ldquo;{p.hook || "(no caption)"}&rdquo;</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill tone="var(--hx-0a84ff)">{HOOK_LABEL[p.hook_type] ?? p.hook_type}</Pill>
                      <Pill>{FORMAT_LABEL[p.format] ?? p.format}{p.format_tag ? ` · ${p.format_tag.replace(/_/g, " ")}` : ""}</Pill>
                      <Pill tone={p.cta_kind === "comment_keyword" ? "var(--hx-30d158)" : undefined}>{p.cta_kind === "comment_keyword" ? `Comment "${p.cta_keyword}"` : CTA_LABEL[p.cta_kind] ?? p.cta_kind}</Pill>
                      {p.niche && <Pill>{p.niche}</Pill>}
                      <span className="text-[11.5px] text-[color:var(--hx-6e6e73)]">@{p.username ?? "unknown"} · {ago(p.posted_at)} · {n(p.like_count)} likes · {n(p.comments_count)} comments · via {p.source === "hashtag" ? `#${p.source_key}` : "account"}</span>
                    </div>
                    {p.why && p.why.length > 0 && <ul className="text-[12px] text-[color:var(--hx-a1a1a6)] list-disc pl-4">{p.why.map((w) => <li key={w}>{w}</li>)}</ul>}
                    <div className="flex items-center gap-2">
                      {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[color:var(--hx-0a84ff)]"><ExternalLink size={12} /> Open post</a>}
                      {p.format === "reel" && <select value={p.format_tag ?? ""} onChange={(e) => void post({ action: "tag_format", id: p.id, format_tag: e.target.value }, `tag-${p.id}`)} className="h-[26px] rounded-[6px] px-1.5 text-[11.5px]" style={input}>{FORMAT_TAGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {tab === "patterns" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[12px] p-4 text-[13px] text-[color:var(--hx-f5f5f7)]" style={{ ...card, borderColor: "rgb(var(--w) / 0.18)" }}><strong>Packaging beats production.</strong> <span className="text-[color:var(--hx-a1a1a6)]">{d.principle}</span></div>
              <div className="text-[12px] text-[color:var(--hx-6e6e73)]">{d.patterns.total} tracked posts · median velocity {n(d.patterns.overallMedianVelocity)}/h · lift = group median ÷ overall median · groups under 3 posts are greyed out</div>
              <div className="rounded-[12px] overflow-hidden" style={card}>
                <div className="px-4 py-3 text-[13px] font-semibold text-[color:var(--hx-f5f5f7)]">Testable variables</div>
                {d.patterns.testable.map((t) => <div key={t.key} className="px-4 py-3 grid md:grid-cols-[220px_1fr_1fr] gap-2 text-[12.5px]" style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }}><div className="font-medium text-[color:var(--hx-f5f5f7)]">{t.label}{!t.measurable && <span className="ml-1 text-[10.5px] text-[color:var(--hx-6e6e73)]">(by eye)</span>}</div><div className="text-[color:var(--hx-a1a1a6)]">{t.evidence}</div><div className="text-[color:var(--hx-6e6e73)]">Test: {t.suggestion}</div></div>)}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <GroupTable title="Hooks — velocity" metric="velocity" groups={d.patterns.byHook} />
                <GroupTable title="CTAs — comments (saves aren't public for other accounts)" metric="comments" groups={d.patterns.byCta} />
                <GroupTable title="Formats — velocity (tag reels as talking head / screen recording to split them)" metric="velocity" groups={d.patterns.byFormat} />
                <GroupTable title="Post time (ET) — velocity" metric="velocity" groups={d.patterns.byHour} />
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-[12px] p-4" style={card}><div className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)] mb-2">Comment keywords that pull replies</div>{d.patterns.ctaKeywords.length === 0 ? <div className="text-[12.5px] text-[color:var(--hx-6e6e73)]">None seen yet.</div> : d.patterns.ctaKeywords.map((k) => <div key={k.keyword} className="flex justify-between text-[12.5px] py-1"><span className="text-[color:var(--hx-f5f5f7)]">&ldquo;{k.keyword}&rdquo;</span><span className="text-[color:var(--hx-a1a1a6)]">{n(k.medianComments)} median comments · n={k.n}</span></div>)}</div>
                <div className="rounded-[12px] p-4" style={card}><div className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)] mb-2">Hashtags on the top 25% by velocity</div>{d.patterns.hashtags.length === 0 ? <div className="text-[12.5px] text-[color:var(--hx-6e6e73)]">No data yet.</div> : <div className="flex flex-wrap gap-1.5">{d.patterns.hashtags.map((h) => <Pill key={h.tag}>#{h.tag} · {h.topShare}%</Pill>)}</div>}</div>
              </div>
            </div>
          )}

          {tab === "setup" && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-[12px] p-4 flex flex-col gap-3" style={card}>
                <div className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)]">Competitor accounts</div>
                <div className="text-[12px] text-[color:var(--hx-6e6e73)]">Business or Creator accounts only (Instagram&apos;s rule). Last 25 posts each, refreshed daily.</div>
                <form onSubmit={async (e) => { e.preventDefault(); if (await post({ action: "add_account", ...acct }, "add")) setAcct({ username: "", niche: acct.niche }); }} className="flex gap-2">
                  <input value={acct.username} onChange={(e) => setAcct({ ...acct, username: e.target.value })} placeholder="@username" className="flex-1 h-[34px] rounded-[8px] px-3 text-[13px]" style={input} />
                  <select value={acct.niche} onChange={(e) => setAcct({ ...acct, niche: e.target.value })} className="h-[34px] rounded-[8px] px-2 text-[12.5px]" style={input}><option value="">Niche…</option>{niches.map((x) => <option key={x}>{x}</option>)}</select>
                  <button type="submit" disabled={busy === "add" || !acct.username} className="inline-flex items-center gap-1 h-[34px] px-3 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-50" style={{ background: "rgb(var(--w))", color: "rgb(var(--k))" }}><Plus size={13} /> Watch</button>
                </form>
                {d.accounts.length === 0 ? <div className="text-[12.5px] text-[color:var(--hx-6e6e73)]">No accounts yet.</div> : d.accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-[12.5px] py-1" style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }}>
                    <div className="min-w-0"><a href={`https://instagram.com/${a.username}`} target="_blank" rel="noopener noreferrer" className="text-[color:var(--hx-f5f5f7)]">@{a.username}</a> {a.niche && <span className="text-[color:var(--hx-6e6e73)]">· {a.niche}</span>}{a.last_error && <div className="text-[11px] text-[color:var(--hx-ff453a)] truncate" title={a.last_error}>{a.last_error}</div>}</div>
                    <div className="flex items-center gap-2"><label className="flex items-center gap-1 text-[11.5px] text-[color:var(--hx-a1a1a6)]"><input type="checkbox" checked={a.active} onChange={(e) => void post({ action: "toggle_account", id: a.id, active: e.target.checked }, `t-${a.id}`)} /> Active</label><button type="button" onClick={() => void post({ action: "remove_account", id: a.id }, `r-${a.id}`)} className="text-[color:var(--hx-6e6e73)] hover:text-white"><X size={14} /></button></div>
                  </div>
                ))}
              </div>
              <div className="rounded-[12px] p-4 flex flex-col gap-3" style={card}>
                <div className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)]">Niches &amp; hashtags</div>
                <div className="text-[12px] text-[color:var(--hx-6e6e73)]">One niche per line: <code>Name: #tag #tag</code>. Instagram allows {d.hashtagBudget.cap} unique hashtags per rolling week ({d.hashtagBudget.used} used this week).</div>
                <textarea value={nicheDraft} onChange={(e) => setNicheDraft(e.target.value)} rows={6} className="rounded-[8px] px-3 py-2 text-[12.5px] font-mono" style={input} />
                <button type="button" disabled={busy === "niches"} onClick={() => void post({ action: "save_niches", niches: nicheDraft.split("\n").map((l) => { const [name, tags = ""] = l.split(":"); return { name: name.trim(), hashtags: tags.split(/[\s,]+/).filter(Boolean) }; }) }, "niches")} className="self-start h-[34px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-50" style={{ background: "rgb(var(--w))", color: "rgb(var(--k))" }}>Save niches</button>
                {d.lastResult && <div className="text-[11.5px] text-[color:var(--hx-6e6e73)] leading-relaxed">Last run: {d.lastResult.message}{d.lastResult.blockedHashtags?.length ? ` · over the weekly cap: ${d.lastResult.blockedHashtags.map((t) => `#${t}`).join(" ")}` : ""}{d.lastResult.hashtags?.filter((h) => h.error).map((h) => <div key={h.tag} className="text-[color:var(--hx-ff453a)]">#{h.tag}: {h.error}</div>)}</div>}
                <div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">Instagram account: {d.igUsername ? `@${d.igUsername}` : "not linked yet"} · Meta: {d.meta ? `${d.meta.status}${d.meta.label ? ` (${d.meta.label})` : ""}` : "not connected"}</div>
              </div>
            </div>
          )}

          {(tab === "clips" || tab === "publish") && (
            <div className="rounded-[12px] p-6 text-[13px] text-[color:var(--hx-a1a1a6)] leading-relaxed" style={card}>
              <div className="text-[14px] font-semibold text-[color:var(--hx-f5f5f7)] mb-1">{tab === "clips" ? "Clip Factory — Phase 2, not built yet" : "Publish Queue — Phase 3, not built yet"}</div>
              {tab === "clips" ? "Upload a long video → free local transcription → 5–10 scored clip proposals with hooks from the pattern library → you approve each cut." : "Auto-cut, burned-in word-by-word captions, hook overlay, thumbnail, caption with a comment-keyword CTA → your one-tap approval → post to Instagram. Nothing ever posts without your approval."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
