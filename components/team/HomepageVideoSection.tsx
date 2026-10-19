"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Homepage "Watch it work" video (Roman, 2026-10-12). Owner uploads the file
// to the public `site-media` bucket (or pastes any https URL) and saves. The
// homepage shows the real player the moment a URL exists; cleared → honest
// "coming" state. No mockups, no placeholder thumbnails.
type Settings = { walkthrough_video_url: string | null; walkthrough_poster_url: string | null; updated_at: string | null };
const input: React.CSSProperties = { background: "var(--hx-101010)", border: "1px solid rgb(var(--w) / 0.08)", color: "var(--hx-f5f5f7)" };

export default function HomepageVideoSection() {
  const [s, setS] = useState<Settings | null>(null); const [video, setVideo] = useState(""); const [poster, setPoster] = useState("");
  const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null); const posterRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => { const r = await fetch("/api/team/site-settings", { cache: "no-store" }); if (!r.ok) return; const j = await r.json(); setS(j.settings); setVideo(j.settings.walkthrough_video_url ?? ""); setPoster(j.settings.walkthrough_poster_url ?? ""); }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (patch: Partial<Settings>) => {
    setBusy("save"); setErr(null); setMsg(null);
    try { const r = await fetch("/api/team/site-settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Save failed."); setS(j.settings); setVideo(j.settings.walkthrough_video_url ?? ""); setPoster(j.settings.walkthrough_poster_url ?? ""); setMsg(j.settings.walkthrough_video_url ? "Saved — the homepage shows this video (allow up to 5 minutes for the page cache)." : "Cleared — the homepage shows the “coming” state again."); }
    catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); } finally { setBusy(null); }
  };

  const upload = async (file: File, kind: "video" | "poster") => {
    setBusy(kind); setErr(null); setMsg(null);
    try {
      const sb = createSupabaseBrowserClient(); const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase();
      const path = kind === "video" ? `walkthrough/sfb-walkthrough-${Date.now()}.${ext}` : `walkthrough/poster-${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("site-media").upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw new Error(error.message);
      const { data } = sb.storage.from("site-media").getPublicUrl(path);
      await save(kind === "video" ? { walkthrough_video_url: data.publicUrl } : { walkthrough_poster_url: data.publicUrl });
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); setBusy(null); }
  };

  if (!s) return <div className="text-[13px] text-[color:var(--hx-6e6e73)]">Loading…</div>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[color:var(--hx-a1a1a6)]">What visitors see in the homepage “Watch it work” box. Upload the walkthrough (MP4, H.264) or paste an https URL. Until a video is set the box says the recording is coming — it never shows a mockup.</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[12px] text-[color:var(--hx-a1a1a6)]">Video URL</label>
          <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://…/sfb-walkthrough-v1.mp4" className="h-[40px] rounded-lg px-3 text-[13px] outline-none" style={input} />
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="h-[34px] px-4 rounded-full text-[12.5px] font-semibold border border-white/[0.14] text-[color:var(--hx-f5f5f7)] disabled:opacity-50">{busy === "video" ? "Uploading…" : "Upload MP4"}</button>
            <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, "video"); e.currentTarget.value = ""; }} />
            <button type="button" onClick={() => void save({ walkthrough_video_url: video || null })} disabled={!!busy} className="h-[34px] px-4 rounded-full text-[12.5px] font-semibold bg-white text-black disabled:opacity-50">{busy === "save" ? "Saving…" : "Save URL"}</button>
            {s.walkthrough_video_url && <button type="button" onClick={() => void save({ walkthrough_video_url: null })} disabled={!!busy} className="h-[34px] px-4 rounded-full text-[12.5px] border border-white/[0.14] text-[color:var(--hx-ff9f9a)] disabled:opacity-50">Clear (back to “coming”)</button>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[12px] text-[color:var(--hx-a1a1a6)]">Poster image (optional — the still shown before play)</label>
          <input value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="https://…/poster.jpg" className="h-[40px] rounded-lg px-3 text-[13px] outline-none" style={input} />
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => posterRef.current?.click()} disabled={!!busy} className="h-[34px] px-4 rounded-full text-[12.5px] font-semibold border border-white/[0.14] text-[color:var(--hx-f5f5f7)] disabled:opacity-50">{busy === "poster" ? "Uploading…" : "Upload image"}</button>
            <input ref={posterRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, "poster"); e.currentTarget.value = ""; }} />
            <button type="button" onClick={() => void save({ walkthrough_poster_url: poster || null })} disabled={!!busy} className="h-[34px] px-4 rounded-full text-[12.5px] font-semibold border border-white/[0.14] text-[color:var(--hx-f5f5f7)] disabled:opacity-50">Save poster</button>
          </div>
        </div>
      </div>
      {s.walkthrough_video_url && <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgb(var(--w) / 0.08)", maxWidth: 560 }}><video controls preload="metadata" poster={s.walkthrough_poster_url ?? undefined} src={s.walkthrough_video_url} className="w-full aspect-video bg-black" /></div>}
      <div className="text-[12px] text-[color:var(--hx-6e6e73)]">Current: {s.walkthrough_video_url ? <span className="font-mono text-[11.5px] text-[color:var(--hx-a1a1a6)] break-all">{s.walkthrough_video_url}</span> : "none — homepage shows the “coming” state"}{s.updated_at && ` · updated ${new Date(s.updated_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET`}</div>
      {msg && <div className="text-[12.5px] text-[color:var(--hx-30d158)]">{msg}</div>}{err && <div className="text-[12.5px] text-[color:var(--hx-ff9f9a)]">{err}</div>}
    </div>
  );
}
