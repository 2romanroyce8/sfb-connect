"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderSource, TEMPLATE_VARIABLES, validateSource } from "@/lib/outbound/templates";

type Preview = { subject: string; body: string } | { error: string };
type Item = { key: string; name: string; category: string; categoryLabel: string; tone: string; audience: string; description: string; subject: string; body: string; preview: Preview; saved: boolean; approved: boolean };
type Library = { items: Item[]; categories: { key: string; label: string; hint: string }[]; variables: typeof TEMPLATE_VARIABLES; sample: { company: string; contact_name: string | null; city: string | null; category: string | null; placeholder: boolean }; introTemplate: string | null; recommendation: { key: string; reason: string }; offerLineMissing: boolean };
type Assist = { configured: boolean; capped: boolean; instructions: { key: string; label: string; prompt: string }[] };
export type Compose = { mode: "agent" | "preset" | "custom"; template: string; custom: { subject: string; body: string } | null; label: string };

type Props = {
  target: { kind: "onboarding" } | { kind: "team"; businessId: string };
  dark?: boolean;
  /** Called whenever the choice changes; the parent passes it to launch. */
  onChange: (c: Compose) => void;
};

/** Compose flow: Have the agent draft (recommended intro, override allowed) · Pick a preset (library with live previews) · Write my own (variables, live preview, editing help, save as preset). */
export default function ComposePicker({ target, dark = false, onChange }: Props) {
  const [lib, setLib] = useState<Library | null>(null); const [assist, setAssist] = useState<Assist | null>(null);
  const [mode, setMode] = useState<Compose["mode"]>("agent"); const [cat, setCat] = useState<string>("intro_b2b"); const [presetKey, setPresetKey] = useState<string | null>(null);
  const [subject, setSubject] = useState(""); const [bodyText, setBodyText] = useState(""); const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [saveName, setSaveName] = useState(""); const bodyRef = useRef<HTMLTextAreaElement>(null);

  const post = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    const r = target.kind === "onboarding"
      ? await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) })
      : await fetch("/api/team/outbound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ business_id: target.businessId, action, ...data, template: data.key ?? data.template, template_id: data.id }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed."); return j;
  }, [target]);
  const load = useCallback(async () => { try { const j = await post("template_library"); setLib(j.library); setAssist(j.assist); } catch (e) { setErr(e instanceof Error ? e.message : "Could not load templates."); } }, [post]);
  useEffect(() => { void load(); }, [load]);

  const t = dark
    ? { text: "text-[#F5F5F7]", muted: "text-[#A1A1A6]", faint: "text-[#6E6E73]", box: "border border-white/[0.1] bg-[#0F0F0F]", input: "bg-[#0F0F0F] text-[#F5F5F7] border border-white/[0.14]", primary: "bg-white text-black", ghost: "border border-white/[0.14] text-[#F5F5F7]", sel: "border-white", ok: "text-[#30D158]", bad: "text-[#FF6961]", chip: "bg-white/[0.06] text-[#D0D0D0]" }
    : { text: "text-neutral-900", muted: "text-neutral-600", faint: "text-neutral-400", box: "border border-neutral-200 bg-white", input: "bg-white text-neutral-900 border border-neutral-300", primary: "bg-neutral-900 text-white", ghost: "border border-neutral-300 text-neutral-900", sel: "border-neutral-900", ok: "text-emerald-700", bad: "text-red-600", chip: "bg-neutral-100 text-neutral-700" };

  const introKey = lib?.introTemplate ?? lib?.recommendation.key ?? "intro";
  const introItem = lib?.items.find((i) => i.key === introKey) ?? null;
  const emit = useCallback((c: Compose) => onChange(c), [onChange]);
  useEffect(() => { if (!lib) return; if (mode === "agent") emit({ mode, template: introKey, custom: null, label: introItem?.name ?? introKey }); if (mode === "preset" && presetKey) { const it = lib.items.find((i) => i.key === presetKey); emit({ mode, template: presetKey, custom: null, label: it?.name ?? presetKey }); } if (mode === "custom") emit({ mode, template: "custom", custom: { subject, body: bodyText }, label: "Your own email" }); }, [lib, mode, introKey, introItem, presetKey, subject, bodyText, emit]);

  const customPreview = useMemo<Preview>(() => {
    if (!lib) return { error: "" }; const bad = validateSource({ subject, body: bodyText }); if (bad.length) return { error: `Unknown placeholder ${bad.map((b) => `{{${b}}}`).join(", ")}` };
    if (!subject.trim() && !bodyText.trim()) return { error: "" };
    try { return renderSource({ subject, body: bodyText, requires: [] }, { company: lib.sample.company, contact_name: lib.sample.contact_name, city: lib.sample.city, category: lib.sample.category, sender_name: "{your name}", sender_company: "{your business}", sender_category: null, offer_line: "{your offer line}" }); } catch (e) { return { error: e instanceof Error ? e.message : "Can't preview." }; }
  }, [lib, subject, bodyText]);

  const pickIntro = async (key: string | null) => { setBusy("pick"); setErr(null); try { await post("template_pick", { key }); await load(); setMsg(key ? "Saved — your sequences will use this intro." : "Back to the agent's recommendation."); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(null); } };
  const insertVar = (tok: string) => { const el = bodyRef.current; if (!el) { setBodyText((b) => b + tok); return; } const s = el.selectionStart ?? bodyText.length, e = el.selectionEnd ?? s; setBodyText(bodyText.slice(0, s) + tok + bodyText.slice(e)); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tok.length, s + tok.length); }); };
  // Editing help is only offered when the server says the provider is configured; a cap hit mid-session flips the buttons off without an error toast.
  const help = async (instruction: string) => { setBusy(instruction); setErr(null); setMsg(null); try { const j = await post("template_assist", { subject, body: bodyText, instruction }); setSubject(j.edited.subject); setBodyText(j.edited.body); setMsg("Edited — read it over before you use it."); } catch (e) { const m = e instanceof Error ? e.message : "Editing help failed."; if (/spend limit/i.test(m)) setAssist((a) => (a ? { ...a, capped: true } : a)); else setErr(m); } finally { setBusy(null); } };
  const savePreset = async () => { setBusy("save"); setErr(null); try { await post("template_save", { name: saveName, subject, body: bodyText, category: "custom" }); setSaveName(""); await load(); setMsg("Saved to your library."); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(null); } };

  if (!lib) return <div className={`text-[13px] ${t.faint}`}>{err ?? "Loading templates…"}</div>;
  const Tab = ({ k, label, hint }: { k: Compose["mode"]; label: string; hint: string }) => <button type="button" onClick={() => setMode(k)} className={`rounded-xl p-3 text-left border ${mode === k ? t.sel : dark ? "border-white/[0.1]" : "border-neutral-200"}`}><div className={`text-[13.5px] font-semibold ${t.text}`}>{label}</div><div className={`text-[12px] ${t.faint} mt-0.5`}>{hint}</div></button>;
  const Prev = ({ p, label }: { p: Preview; label?: string }) => "error" in p ? (p.error ? <div className={`text-[12px] ${t.bad}`}>{p.error}</div> : null) : <div className={`rounded-lg p-3 text-[12.5px] ${dark ? "bg-black/40" : "bg-neutral-50"}`}>{label && <div className={`text-[10.5px] uppercase tracking-wide ${t.faint} mb-1`}>{label}</div>}<div className={`font-medium ${t.text}`}>{p.subject}</div><pre className={`mt-1.5 whitespace-pre-wrap font-sans leading-relaxed ${t.muted}`}>{p.body}</pre></div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid sm:grid-cols-3 gap-2">
        <Tab k="agent" label="Have the agent draft" hint={`Recommended: ${lib.items.find((i) => i.key === lib.recommendation.key)?.name ?? lib.recommendation.key}`} />
        <Tab k="preset" label="Pick a preset" hint={`${lib.items.length} in the library, previewed with your info`} />
        <Tab k="custom" label="Write my own" hint="Your words, our variables, same approval queue" />
      </div>
      {lib.offerLineMissing && <div className={`text-[12px] ${t.bad}`}>Your offer line is empty — intros that use {"{{offer_line}}"} can&apos;t be drafted until it&apos;s set (step 1 / Prospects page).</div>}
      {lib.sample.placeholder && <div className={`text-[11.5px] ${t.faint}`}>Previews use a sample prospect until your list has someone on it.</div>}

      {mode === "agent" && (
        <div className={`rounded-2xl p-4 flex flex-col gap-3 ${t.box}`}>
          <div className={`text-[13px] ${t.muted}`}><span className={`font-semibold ${t.text}`}>{lib.introTemplate ? "Your pick" : "Agent's recommendation"}:</span> {introItem?.name ?? introKey}. <span className={t.faint}>{lib.introTemplate ? "You chose this; the recommendation would have been " + (lib.items.find((i) => i.key === lib.recommendation.key)?.name ?? lib.recommendation.key) + "." : lib.recommendation.reason}</span></div>
          <div className="grid md:grid-cols-2 gap-2">
            {["intro", "intro_b2c"].map((k) => { const it = lib.items.find((i) => i.key === k); if (!it) return null; const active = introKey === k; return (
              <button type="button" key={k} onClick={() => void pickIntro(k)} disabled={busy === "pick"} className={`rounded-xl p-3 text-left border ${active ? t.sel : dark ? "border-white/[0.1]" : "border-neutral-200"}`}>
                <div className="flex items-center justify-between"><div className={`text-[13px] font-semibold ${t.text}`}>{it.name}</div>{lib.recommendation.key === k && <span className={`text-[10px] uppercase tracking-wide rounded-full px-1.5 py-0.5 ${t.chip}`}>Recommended</span>}</div>
                <div className={`text-[12px] ${t.faint} mt-0.5`}>{it.description}</div>
              </button>); })}
          </div>
          {introItem && <Prev p={introItem.preview} label="Preview with your info" />}
          <div className="flex items-center gap-3 flex-wrap text-[12px]"><span className={t.faint}>Want a different tone, or one of your saved presets? Use “Pick a preset”.</span>{lib.introTemplate && <button type="button" onClick={() => void pickIntro(null)} className={`underline ${t.muted}`}>Use the agent&apos;s recommendation instead</button>}</div>
        </div>
      )}

      {mode === "preset" && (
        <div className={`rounded-2xl p-4 flex flex-col gap-3 ${t.box}`}>
          <div className="flex gap-1.5 flex-wrap">{[...lib.categories, { key: "saved", label: "Your saved presets", hint: "" }].map((c) => <button type="button" key={c.key} onClick={() => setCat(c.key)} className={`h-[30px] px-3 rounded-full text-[12px] ${cat === c.key ? t.primary : t.ghost}`}>{c.label}</button>)}</div>
          <div className="grid md:grid-cols-2 gap-2">
            {lib.items.filter((i) => (cat === "saved" ? i.saved : i.category === cat)).map((i) => (
              <button type="button" key={i.key} onClick={() => setPresetKey(i.key)} className={`rounded-xl p-3 text-left border ${presetKey === i.key ? t.sel : dark ? "border-white/[0.1]" : "border-neutral-200"}`}>
                <div className="flex items-center justify-between gap-2"><div className={`text-[13px] font-semibold ${t.text}`}>{i.name}</div><span className={`text-[10px] uppercase tracking-wide ${t.faint}`}>{i.tone}</span></div>
                <div className={`text-[12px] ${t.faint} mt-0.5`}>{i.description}</div>
                {"subject" in i.preview && <div className={`text-[12px] ${t.muted} mt-2 truncate`}>“{i.preview.subject}”</div>}
              </button>))}
            {lib.items.filter((i) => (cat === "saved" ? i.saved : i.category === cat)).length === 0 && <div className={`text-[12.5px] ${t.faint}`}>{cat === "saved" ? "Nothing saved yet — write your own, or save a sent email from the Decided list." : "No presets here yet."}</div>}
          </div>
          {presetKey && (() => { const it = lib.items.find((i) => i.key === presetKey); return it ? <><Prev p={it.preview} label="Preview with your info" />{(it.category === "intro_b2b" || it.category === "intro_b2c" || it.saved) && <button type="button" onClick={() => void pickIntro(it.key)} disabled={busy === "pick"} className={`self-start h-[36px] px-4 rounded-full text-[12.5px] font-semibold ${t.ghost}`}>{busy === "pick" ? "Saving…" : "Also make this my sequence intro"}</button>}</> : null; })()}
        </div>
      )}

      {mode === "custom" && (
        <div className={`rounded-2xl p-4 flex flex-col gap-3 ${t.box}`}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject — e.g. A quick note from {{sender_name}}" className={`h-[40px] rounded-lg px-3 text-[13.5px] outline-none ${t.input}`} />
          <textarea ref={bodyRef} value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={9} placeholder={"Hi {{first_name}},\n\nWrite it the way you'd say it. Variables fill in per person.\n\n{{sender_name}}\n{{sender_company}}"} className={`rounded-lg px-3 py-2 text-[13.5px] outline-none leading-relaxed ${t.input}`} />
          <div className="flex gap-1.5 flex-wrap items-center"><span className={`text-[11.5px] ${t.faint}`}>Insert:</span>{lib.variables.map((v) => <button type="button" key={v.token} onClick={() => insertVar(v.token)} title={v.label} className={`h-[26px] px-2 rounded-md text-[11.5px] font-mono ${t.chip}`}>{v.token}</button>)}</div>
          {assist?.configured && assist.instructions.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className={`text-[11.5px] ${t.faint}`}>Agent help:</span>
              {assist.instructions.map((i) => <button type="button" key={i.key} onClick={() => void help(i.key)} disabled={!!busy || assist.capped || !subject.trim() || !bodyText.trim()} className={`h-[30px] px-3 rounded-full text-[12px] disabled:opacity-50 ${t.ghost}`}>{busy === i.key ? "Working…" : i.label}</button>)}
              {assist.capped && <span className={`text-[11.5px] ${t.faint}`}>Paused until tomorrow — today&apos;s editing-help limit was reached. Hand edits still work.</span>}
            </div>
          )}
          <Prev p={customPreview} label="Preview with your info" />
          <div className="flex items-center gap-2 flex-wrap">
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this preset to reuse it" className={`h-[34px] rounded-lg px-3 text-[12.5px] outline-none ${t.input}`} />
            <button type="button" onClick={() => void savePreset()} disabled={!!busy || !saveName.trim() || !subject.trim() || !bodyText.trim()} className={`h-[34px] px-4 rounded-full text-[12.5px] font-semibold disabled:opacity-50 ${t.ghost}`}>{busy === "save" ? "Saving…" : "Save as preset"}</button>
            <span className={`text-[11.5px] ${t.faint}`}>Your email still goes through the approval queue (2 credits per draft, 5 to approve) — same as the agent&apos;s.</span>
          </div>
        </div>
      )}
      {msg && <div className={`text-[12.5px] ${t.ok}`}>{msg}</div>}{err && <div className={`text-[12.5px] ${t.bad}`}>{err}</div>}
    </div>
  );
}
