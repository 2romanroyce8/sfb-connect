"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOURS, placeTooltip, nextPresentStep, progressLabel, isMobile, CARD_W, type TourDef, type TourStep } from "@/lib/tours/definitions";

// Guided tour engine (Roman, 2026-10-12). Data-driven: it only knows how to
// show a step array. Dimmed spotlight (box-shadow, pointer-through so the
// highlighted action stays clickable), short card, Next/Back/Skip, progress,
// "Don't show again", Esc/arrows, bottom sheet on mobile. A missing target
// skips silently. Dismissing never touches onboarding state — the tour only
// reads the page.

type State = { tour: TourDef; index: number; sessionId: string; rect: { top: number; left: number; width: number; height: number } | null; waiting: boolean };
type Ctx = { start: (key: string, opts?: { replay?: boolean }) => void; active: string | null; tours: TourDef[]; state: Record<string, { status: string; dont_show: boolean; last_step: number }> };
const TourCtx = createContext<Ctx>({ start: () => undefined, active: null, tours: [], state: {} });
export const useTour = () => useContext(TourCtx);

const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.padEnd(36, "0").slice(0, 36));
const findTarget = (s: TourStep) => (typeof document === "undefined" ? null : (document.querySelector(s.target) as HTMLElement | null));

export default function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [saved, setSaved] = useState<Ctx["state"]>({}); const [loaded, setLoaded] = useState(false);
  const [st, setSt] = useState<State | null>(null); const [dontShow, setDontShow] = useState(false);
  const stRef = useRef<State | null>(null); stRef.current = st;
  const device = typeof window !== "undefined" && isMobile({ width: window.innerWidth, height: window.innerHeight }) ? "mobile" : "desktop";

  const log = useCallback((tour: string, action: string, extra: Record<string, unknown> = {}) => {
    const s = stRef.current;
    void fetch("/api/dashboard/tours", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tour, action, sessionId: s?.sessionId ?? extra.sessionId, device, ...extra }) }).catch(() => undefined);
  }, [device]);

  useEffect(() => { (async () => { try { const r = await fetch("/api/dashboard/tours", { cache: "no-store" }); if (r.ok) setSaved(((await r.json()) as { state: Ctx["state"] }).state ?? {}); } catch { /* no state → no auto-start */ } finally { setLoaded(true); } })(); }, []);

  /** Show step i (navigating to its route if needed); skip forward/back over missing targets. */
  const show = useCallback(async (tour: TourDef, i: number, sessionId: string, dir: 1 | -1 = 1) => {
    if (i < 0 || i >= tour.steps.length) { finish(tour, sessionId); return; }
    const step = tour.steps[i];
    if (step.route && window.location.pathname !== step.route) { setSt({ tour, index: i, sessionId, rect: null, waiting: true }); router.push(step.route); }
    // Wait up to 2.5 s for the target to exist (route change / client render).
    const deadline = Date.now() + 2500; let el = findTarget(step);
    while (!el && Date.now() < deadline) { await new Promise((r) => setTimeout(r, 100)); el = findTarget(step); }
    if (!el) {
      log(tour.key, "step_skipped", { step: i, sessionId });
      const nxt = i + dir; if (nxt < 0 || nxt >= tour.steps.length) { finish(tour, sessionId); return; }
      return show(tour, nxt, sessionId, dir);
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    await new Promise((r) => setTimeout(r, 250));
    const r = el.getBoundingClientRect();
    setSt({ tour, index: i, sessionId, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, waiting: false });
    log(tour.key, "step", { step: i, sessionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, log]);

  const finish = useCallback((tour: TourDef, sessionId: string) => { log(tour.key, "completed", { sessionId, step: tour.steps.length - 1 }); setSaved((s) => ({ ...s, [tour.key]: { ...(s[tour.key] ?? { dont_show: false, last_step: 0 }), status: "completed" } })); setSt(null); }, [log]);
  const skip = useCallback(() => { const s = stRef.current; if (!s) return; log(s.tour.key, "skipped", { step: s.index }); if (dontShow) log(s.tour.key, "dont_show", { dontShow: true }); setSaved((x) => ({ ...x, [s.tour.key]: { ...(x[s.tour.key] ?? { last_step: 0 }), status: "skipped", dont_show: dontShow || x[s.tour.key]?.dont_show || false } })); setSt(null); }, [log, dontShow]);
  const next = useCallback(() => { const s = stRef.current; if (!s || s.waiting) return; if (s.index + 1 >= s.tour.steps.length) { if (dontShow) log(s.tour.key, "dont_show", { dontShow: true }); finish(s.tour, s.sessionId); return; } void show(s.tour, s.index + 1, s.sessionId, 1); }, [show, finish, dontShow, log]);
  const back = useCallback(() => { const s = stRef.current; if (!s || s.waiting || s.index === 0) return; void show(s.tour, s.index - 1, s.sessionId, -1); }, [show]);

  const start = useCallback((key: string, opts?: { replay?: boolean }) => {
    const tour = TOURS[key]; if (!tour || stRef.current) return;
    const sessionId = uuid(); setDontShow(false);
    log(key, "started", { sessionId });
    setSaved((s) => ({ ...s, [key]: { ...(s[key] ?? { dont_show: false }), status: "started", last_step: 0 } }));
    const first = opts?.replay ? 0 : 0;
    void show(tour, nextPresentStep(tour.steps, first, () => true), sessionId, 1);
  }, [show, log]);

  // Auto-start once per tour on first entry (never when completed/skipped/don't-show).
  useEffect(() => {
    if (!loaded || st) return;
    const t = Object.values(TOURS).find((x) => x.autoStart(pathname));
    if (!t) return; const s = saved[t.key];
    if (s && (s.dont_show || s.status === "completed" || s.status === "skipped" || s.status === "started")) return;
    const id = setTimeout(() => start(t.key), 900); return () => clearTimeout(id);
  }, [loaded, pathname, saved, st, start]);

  // Keep the spotlight on the target through scroll/resize; Esc / arrows.
  useEffect(() => {
    if (!st || st.waiting) return;
    const step = st.tour.steps[st.index];
    const update = () => { const el = findTarget(step); if (!el) return; const r = el.getBoundingClientRect(); setSt((x) => (x ? { ...x, rect: { top: r.top, left: r.left, width: r.width, height: r.height } } : x)); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") skip(); else if (e.key === "ArrowRight" || e.key === "Enter") next(); else if (e.key === "ArrowLeft") back(); };
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); window.removeEventListener("keydown", key); };
  }, [st, skip, next, back]);

  const ctx = useMemo<Ctx>(() => ({ start: (k, o) => start(k, o), active: st?.tour.key ?? null, tours: Object.values(TOURS), state: saved }), [start, st, saved]);

  const vp = typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight } : { width: 1280, height: 800 };
  const mobile = isMobile(vp);
  const pos = st?.rect && !mobile ? placeTooltip(st.rect, vp, st.tour.steps[st.index].placement) : null;
  const step = st ? st.tour.steps[st.index] : null;

  return (
    <TourCtx.Provider value={ctx}>
      {children}
      {st && step && !st.waiting && st.rect && (
        <div className="fixed inset-0 z-[90] pointer-events-none" aria-live="polite">
          <div className="absolute rounded-[10px] transition-all duration-200" style={{ top: st.rect.top - 6, left: st.rect.left - 6, width: st.rect.width + 12, height: st.rect.height + 12, boxShadow: "0 0 0 9999px rgba(10,10,10,0.55)", border: "2px solid rgba(255,255,255,0.9)" }} />
          <div role="dialog" aria-modal="false" aria-label={`${st.tour.name}: ${step.title}`} className={`pointer-events-auto bg-white text-neutral-900 shadow-2xl ${mobile ? "fixed left-0 right-0 bottom-0 rounded-t-[16px] p-5 pb-6" : "absolute rounded-[14px] p-4"}`} style={mobile ? undefined : { top: pos!.top, left: pos!.left, width: CARD_W }}>
            <div className="flex items-center justify-between gap-3 mb-1.5"><div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">{st.tour.name} · {progressLabel(st.index, st.tour.steps.length)}</div><button onClick={skip} className="text-[12px] text-neutral-500 hover:text-neutral-900">Skip</button></div>
            <div className="text-[15px] font-semibold leading-snug">{step.title}</div>
            <div className="text-[13px] text-neutral-600 mt-1 leading-relaxed">{step.body}</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="flex items-center gap-1.5 text-[11.5px] text-neutral-500 cursor-pointer"><input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />Don&apos;t show again</label>
              <div className="flex items-center gap-2">
                {st.index > 0 && <button onClick={back} className="h-[32px] px-3 rounded-full border border-neutral-300 text-[12.5px]">Back</button>}
                <button onClick={next} className="h-[32px] px-3.5 rounded-full bg-neutral-900 text-white text-[12.5px] font-semibold">{st.index + 1 >= st.tour.steps.length ? "Done" : "Next"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {st && st.waiting && <div className="fixed inset-0 z-[90] pointer-events-none" style={{ background: "rgba(10,10,10,0.25)" }} />}
    </TourCtx.Provider>
  );
}

/** Replay buttons (Help page, header). */
export function TourLauncher({ compact = false }: { compact?: boolean }) {
  const { start, tours, state, active } = useTour();
  if (compact) return <button onClick={() => start(tours[0]?.key === "onboarding" && window.location.pathname.startsWith("/dashboard/onboarding") ? "onboarding" : "dashboard", { replay: true })} disabled={!!active} title="Show me around" aria-label="Show me around" className="h-[30px] w-[30px] rounded-full border border-neutral-300 text-[13px] text-neutral-600 hover:bg-neutral-100 disabled:opacity-50">?</button>;
  return (
    <div className="flex flex-col gap-2">
      {tours.map((t) => (
        <div key={t.key} className="flex items-center justify-between gap-4 border border-neutral-200 rounded-xl p-4">
          <div><div className="text-[14px] font-medium text-neutral-900">{t.name}</div><div className="text-[12.5px] text-neutral-500 mt-0.5">{t.description}{state[t.key]?.status ? ` · ${state[t.key].status}${state[t.key].dont_show ? " · hidden" : ""}` : ""}</div></div>
          <button onClick={() => start(t.key, { replay: true })} disabled={!!active} className="h-[36px] px-4 rounded-full bg-neutral-900 text-white text-[13px] font-semibold disabled:opacity-50">Replay</button>
        </div>
      ))}
    </div>
  );
}
