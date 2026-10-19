// iPhone-style multi-select: pure state rules (tested).
// Selection survives filtering/sorting (ids stay selected when hidden), but every
// bulk action only acts on ids that are BOTH selected AND currently visible.
export const toggleId = (sel: ReadonlySet<string>, id: string): Set<string> => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); return n; };
/** Select All = add every visible id (keeps hidden selections). If all visible are already selected, it clears the visible ones. */
export function selectAllVisible(sel: ReadonlySet<string>, visible: readonly string[]): Set<string> {
  const n = new Set(sel); const all = visible.length > 0 && visible.every((id) => n.has(id));
  for (const id of visible) all ? n.delete(id) : n.add(id); return n;
}
export const actionable = (sel: ReadonlySet<string>, visible: readonly string[]): string[] => visible.filter((id) => sel.has(id));
export const allVisibleSelected = (sel: ReadonlySet<string>, visible: readonly string[]) => visible.length > 0 && visible.every((id) => sel.has(id));
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Split ids into request-sized batches (e.g. approve 10 at a time so no request times out). */
export const chunk = <T,>(xs: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };
