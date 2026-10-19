"use client";

// iPhone-style multi-select kit (no dependencies): circles on the left, Select/Cancel/Select All in the
// header, a thumb-reachable bottom action bar, a count confirmation for destructive actions, and a
// short toast afterwards. Tapping a row still opens it; only the circle toggles selection.
import { useCallback, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { actionable, allVisibleSelected, selectAllVisible, toggleId } from "@/lib/ui/selection";

export function useMultiSelect(visibleIds: string[]) {
  const [active, setActive] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const ids = useMemo(() => actionable(sel, visibleIds), [sel, visibleIds]);
  return {
    active, ids, count: ids.length, allSelected: allVisibleSelected(sel, visibleIds),
    isSelected: useCallback((id: string) => sel.has(id), [sel]),
    toggle: useCallback((id: string) => setSel((s) => toggleId(s, id)), []),
    selectAll: () => setSel((s) => selectAllVisible(s, visibleIds)),
    start: () => setActive(true),
    cancel: () => { setActive(false); setSel(new Set()); },
  };
}
export type MultiSelect = ReturnType<typeof useMultiSelect>;

/** The circle. 44px tap target around a 22px circle; never opens the row. */
export function SelectCircle({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label?: string }) {
  return (
    <span role="checkbox" aria-checked={checked} aria-label={label ?? "Select"} tabIndex={0}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onToggle(); } }}
      className="shrink-0 inline-flex items-center justify-center w-[44px] h-[44px] -my-2 -ml-2 cursor-pointer select-none" data-select-circle>
      <span className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center transition-colors"
        style={checked ? { background: "var(--hx-0a84ff)", border: "1.5px solid var(--hx-0a84ff)", color: "#fff" } : { border: "1.5px solid rgb(var(--w) / 0.35)" }}>
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
    </span>
  );
}

/** Header controls: "Select" → (in mode) "Select All" + "Cancel". */
export function SelectToggle({ ms, total, noun = "items" }: { ms: MultiSelect; total: number; noun?: string }) {
  const b = "h-[32px] px-3.5 rounded-full text-[12.5px] font-semibold disabled:opacity-40";
  if (!ms.active) return <button type="button" disabled={total === 0} onClick={ms.start} className={b} style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-f5f5f7)" }} data-select-mode>Select</button>;
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={total === 0} onClick={ms.selectAll} className={b} style={{ color: "var(--hx-0a84ff)" }} data-select-all>{ms.allSelected ? "Deselect All" : `Select All (${total})`}</button>
      <button type="button" onClick={ms.cancel} className={b} style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-f5f5f7)" }} aria-label={`Cancel selecting ${noun}`}>Cancel</button>
    </span>
  );
}

export type BulkAction = {
  label: string;
  tone?: "default" | "primary" | "danger";
  /** Destructive / big actions: confirmation text built from the count, e.g. n => `Delete ${n} emails?` */
  confirm?: (n: number) => string;
  /** Picker actions (change stage, assign): choose one value first. */
  options?: { label: string; value: string }[];
  /** Runs the action on the selected, visible ids. Returns the toast text, e.g. "14 emails deleted". */
  run: (ids: string[], value?: string) => Promise<string>;
};

/** Bottom action bar (fixed, safe-area aware, full-width on phones) + confirmation + toast. */
export function BulkBar({ ms, noun, actions }: { ms: MultiSelect; noun: (n: number) => string; actions: BulkAction[] }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ a: BulkAction; value?: string } | null>(null);
  const [picker, setPicker] = useState<BulkAction | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const flash = (text: string, error = false) => { setToast({ text, error }); window.setTimeout(() => setToast(null), 3200); };
  const exec = async (a: BulkAction, value?: string) => {
    const ids = ms.ids; if (!ids.length) return;
    setBusy(true); setPending(null); setPicker(null);
    try { const text = await a.run(ids, value); ms.cancel(); flash(text); } catch (e) { flash(e instanceof Error ? e.message : "That didn't work.", true); } finally { setBusy(false); }
  };
  const press = (a: BulkAction) => { if (a.options) setPicker(a); else if (a.confirm) setPending({ a }); else void exec(a); };
  const pick = (a: BulkAction, value: string) => { setPicker(null); a.confirm ? setPending({ a, value }) : void exec(a, value); };
  const tone = (t?: BulkAction["tone"]): React.CSSProperties => t === "danger" ? { background: "var(--hx-ff453a)", color: "#fff" } : t === "primary" ? { background: "var(--hx-0a84ff)", color: "#fff" } : { border: "1px solid rgb(var(--w) / 0.18)", color: "var(--hx-f5f5f7)" };
  return (
    <>
      {ms.active && (
        <div className="fixed inset-x-0 bottom-0 z-[55] flex justify-center px-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }} data-bulk-bar>
          <div className="w-full max-w-[720px] rounded-[18px] px-3 py-2.5 flex flex-wrap items-center gap-2 shadow-2xl" style={{ background: "var(--hx-141414)", border: "1px solid rgb(var(--w) / 0.12)" }} data-theme-lock="dark">
            <span className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)] px-1 mr-auto">{ms.count ? `${noun(ms.count)} selected` : "Tap circles to select"}</span>
            {actions.map((a) => <button key={a.label} type="button" disabled={busy || !ms.count} onClick={() => press(a)} className="h-[44px] px-4 rounded-full text-[13.5px] font-semibold disabled:opacity-40" style={tone(a.tone)}>{a.label}</button>)}
          </div>
        </div>
      )}
      {picker && (
        <Sheet onClose={() => setPicker(null)} title={`${picker.label} · ${noun(ms.count)}`}>
          <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">{picker.options!.map((o) => <button key={o.value} type="button" onClick={() => pick(picker, o.value)} className="h-[44px] px-4 rounded-[12px] text-left text-[14px] text-[color:var(--hx-f5f5f7)]" style={{ background: "rgb(var(--w) / 0.06)" }}>{o.label}</button>)}</div>
        </Sheet>
      )}
      {pending && (
        <Sheet onClose={() => setPending(null)} title={pending.a.confirm!(ms.count)}>
          <div className="text-[12.5px] text-[color:var(--hx-a1a1a6)] mb-3">{pending.a.tone === "danger" ? "This can't be undone." : "This applies to every selected item."}{pending.value && pending.a.options ? ` → ${pending.a.options.find((o) => o.value === pending.value)?.label}` : ""}</div>
          <div className="flex gap-2"><button type="button" onClick={() => setPending(null)} className="flex-1 h-[46px] rounded-full text-[14px] font-semibold" style={tone()}>Cancel</button><button type="button" disabled={busy} onClick={() => void exec(pending.a, pending.value)} className="flex-1 h-[46px] rounded-full text-[14px] font-semibold disabled:opacity-50" style={tone(pending.a.tone === "danger" ? "danger" : "primary")} data-bulk-confirm>{pending.a.label}</button></div>
        </Sheet>
      )}
      {busy && <div className="fixed left-1/2 -translate-x-1/2 bottom-[92px] z-[56] rounded-full px-4 py-2 text-[13px]" style={{ background: "var(--hx-141414)", color: "var(--hx-f5f5f7)", border: "1px solid rgb(var(--w) / 0.12)" }}>Working…</div>}
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[24px] z-[57] rounded-full px-4 py-2.5 text-[13.5px] font-semibold shadow-xl" style={{ background: toast.error ? "var(--hx-ff453a)" : "var(--hx-30d158)", color: "#fff", marginBottom: "env(safe-area-inset-bottom)" }} data-bulk-toast>{toast.text}</div>}
    </>
  );
}

/** Bottom sheet on phones, centered dialog on desktop. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[58] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-[420px] rounded-t-[20px] sm:rounded-[16px] p-4" style={{ background: "var(--hx-0f0f0f)", border: "1px solid rgb(var(--w) / 0.12)", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }} data-theme-lock="dark">
        <div className="text-[16px] font-semibold text-[color:var(--hx-f5f5f7)] mb-3">{title}</div>
        {children}
      </div>
    </div>
  );
}

/** Small helper for list pages: POST JSON, throw the API's error message. */
export async function postJson(url: string, body: Record<string, unknown>) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || "That didn't work.");
  return j;
}
