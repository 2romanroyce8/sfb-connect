"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { layoutGraph, graphBounds, initialsOf, nodeId, type GraphEdge, type GraphNode, type Person, type Positions, type ProjectGraph as Graph } from "@/lib/projects/graph";

// Dependency-free node canvas: pan (drag background), zoom (wheel), drag
// nodes (positions persisted by the parent), SVG edges. Glass nodes on a
// dotted near-black canvas; lime accents. Mobile uses ProjectCards instead.

export type Selection = { kind: "client" } | { kind: "task"; id: string } | { kind: "subtasks"; taskId: string } | { kind: "notes"; taskId: string | null } | { kind: "role"; id: string };
type Props = { graph: Graph; positions: Positions; onMove: (id: string, x: number, y: number) => void; onSelect: (s: Selection) => void; selected: string | null; readOnly?: boolean };

const LIME = "var(--hx-30d158)";
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");
const relDate = (iso: string) => { const d = (Date.now() - new Date(iso).getTime()) / 86400000; return d < 1 ? "Today" : d < 2 ? "Yesterday" : fmtDate(iso); };

export function Avatar({ p, size = 22 }: { p: Person | { name: string; avatar_url: string | null }; size?: number }) {
  return p.avatar_url
    ? <img src={p.avatar_url} alt="" title={p.name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size, border: "1px solid rgb(var(--w) / 0.18)" }} />
    : <span title={p.name} className="rounded-full shrink-0 inline-flex items-center justify-center font-semibold" style={{ width: size, height: size, fontSize: size * 0.42, background: "linear-gradient(135deg,var(--hx-2a2a2e),var(--hx-141416))", border: "1px solid rgb(var(--w) / 0.18)", color: "var(--hx-e5e5ea)" }}>{initialsOf(p.name)}</span>;
}
export function Stack({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <div className="flex items-center gap-1.5 flex-wrap mt-2"><span className="text-[9.5px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-[5px]" style={{ color: LIME, background: "rgba(48,209,88,0.12)" }}>Tech-Stack</span>{items.map((t) => <span key={t} className="text-[10.5px] px-1.5 py-0.5 rounded-[6px] text-white/[0.78]" style={{ background: "rgb(var(--w) / 0.07)", border: "1px solid rgb(var(--w) / 0.1)" }}>{t}</span>)}</div>;
}
function People({ ids, people, label = "Assigned to" }: { ids: string[]; people: Person[]; label?: string }) {
  const list = ids.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  return <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-white/[0.45]">{label}{list.length ? <span className="flex -space-x-1.5">{list.map((p) => <Avatar key={p.id} p={p} />)}</span> : <span className="text-white/[0.3]">— unassigned</span>}</div>;
}

const anchor = (n: GraphNode, side: GraphEdge["fromSide"] | GraphEdge["toSide"], h: number) => side === "bottom" ? { x: n.x + n.w / 2, y: n.y + h } : side === "top" ? { x: n.x + n.w / 2, y: n.y } : side === "right" ? { x: n.x + n.w, y: n.y + Math.min(28, h / 2) } : { x: n.x, y: n.y + Math.min(28, h / 2) };
const path = (a: { x: number; y: number }, b: { x: number; y: number }, vertical: boolean) => vertical
  ? `M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`
  : `M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`;

export default function ProjectGraph({ graph, positions, onMove, onSelect, selected, readOnly = false }: Props) {
  const { nodes, edges } = useMemo(() => layoutGraph(graph, positions), [graph, positions]);
  const [view, setView] = useState({ x: 40, y: 40, k: 1 });
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const wrap = useRef<HTMLDivElement>(null);

  // Measure node heights so edges attach to real bottoms.
  useEffect(() => {
    const next: Record<string, number> = {}; let changed = false;
    for (const n of nodes) { const el = nodeRefs.current[n.id]; const h = el ? el.offsetHeight : 60; next[n.id] = h; if (heights[n.id] !== h) changed = true; }
    if (changed) setHeights(next);
  });
  // Fit on first load / project change.
  useEffect(() => {
    const b = graphBounds(nodes); const el = wrap.current; if (!el) return;
    const k = Math.min(1, (el.clientWidth - 80) / Math.max(1, b.maxX - b.minX), (el.clientHeight - 80) / Math.max(1, b.maxY - b.minY));
    setView({ x: 40 - b.minX * k, y: 40 - b.minY * k, k: Math.max(0.35, k) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.project.id]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = wrap.current!; const r = el.getBoundingClientRect(); const mx = e.clientX - r.left; const my = e.clientY - r.top;
    const k = Math.min(2.2, Math.max(0.3, view.k * (e.deltaY > 0 ? 0.9 : 1.1)));
    setView({ k, x: mx - (mx - view.x) * (k / view.k), y: my - (my - view.y) * (k / view.k) });
  };
  const down = (e: React.PointerEvent, id: string | null) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const n = id ? nodes.find((x) => x.id === id) : null;
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: n ? n.x : view.x, oy: n ? n.y : view.y, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.id === null) setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    else if (!readOnly) onMove(d.id, d.ox + dx / view.k, d.oy + dy / view.k);
  };
  const up = (e: React.PointerEvent, sel?: Selection) => {
    const d = drag.current; drag.current = null; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (d && !d.moved && sel) onSelect(sel);
  };
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const h = (id: string) => heights[id] ?? 60;
  const card = (id: string, extra = "") => `sfb-glass absolute rounded-[14px] select-none ${readOnly ? "" : "cursor-grab active:cursor-grabbing"} ${selected === id ? "ring-1 ring-[color:var(--hx-30d158)]" : ""} ${extra}`;
  const dateLine = (iso: string) => <span className="text-white/[0.4]">Updated: {relDate(iso)}</span>;

  return (
    <div ref={wrap} className="relative w-full h-[calc(100vh-220px)] min-h-[520px] rounded-[16px] overflow-hidden touch-none" style={{ background: "radial-gradient(rgb(var(--w) / 0.09) 1px, transparent 1px) 0 0 / 22px 22px, var(--hx-0a0a0b)", border: "1px solid rgb(var(--w) / 0.08)" }}
      onWheel={onWheel} onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "svg") down(e, null); }} onPointerMove={move} onPointerUp={(e) => up(e)}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="absolute left-0 top-0 overflow-visible pointer-events-none" width={1} height={1}>
          {edges.map((e) => {
            const a = byId[e.from], b = byId[e.to]; if (!a || !b) return null;
            const pa = anchor(a, e.fromSide, h(a.id)), pb = anchor(b, e.toSide, h(b.id)); const vertical = e.fromSide === "bottom";
            const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
            return <g key={e.id}>
              <path d={path(pa, pb, vertical)} fill="none" stroke={e.style === "dashed" ? "rgba(48,209,88,0.75)" : "rgb(var(--w) / 0.35)"} strokeWidth={1.5} strokeDasharray={e.style === "dashed" ? "6 5" : undefined} />
              <circle cx={pa.x} cy={pa.y} r={3} fill={e.style === "dashed" ? LIME : "rgb(var(--w) / 0.6)"} /><circle cx={pb.x} cy={pb.y} r={3} fill={e.style === "dashed" ? LIME : "rgb(var(--w) / 0.6)"} />
              {e.label && <g transform={`translate(${mid.x - 46}, ${mid.y - 11})`}><rect width={92} height={22} rx={11} fill="#161618" stroke="rgba(255,255,255,0.14)" /><text x={46} y={15} textAnchor="middle" fontSize={10.5} fill="rgba(255,255,255,0.7)">{e.label}</text></g>}
            </g>;
          })}
        </svg>

        {nodes.map((n) => {
          const common = { ref: (el: HTMLDivElement | null) => { nodeRefs.current[n.id] = el; }, style: { left: n.x, top: n.y, width: n.w } as React.CSSProperties, onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); down(e, n.id); } };
          if (n.kind === "client") {
            const c = graph.client;
            return <div key={n.id} {...common} className={card(n.id, "px-4 h-[48px] flex items-center gap-2")} onPointerUp={(e) => up(e, { kind: "client" })}>
              <span className="text-[12.5px] text-white/[0.5]">Client:</span>
              {c.logo_url ? <img src={c.logo_url} alt="" className="w-5 h-5 rounded-[5px] object-contain bg-white/[0.08]" /> : <span className="w-5 h-5 rounded-[5px] inline-flex items-center justify-center text-[10px] font-bold" style={{ background: LIME, color: "var(--hx-000000)" }}>{initialsOf(c.name)}</span>}
              <span className="text-[13.5px] font-semibold text-white truncate">{c.name}</span>
              <span className="ml-auto text-[11px] text-white/[0.4] shrink-0">Onboarded: {fmtDate(c.onboarded_at)}</span>
            </div>;
          }
          if (n.kind === "task") {
            const t = graph.tasks.find((x) => x.id === n.ref)!;
            return <div key={n.id} {...common} className={card(n.id, "px-4 py-3.5")} onPointerUp={(e) => up(e, { kind: "task", id: t.id })}>
              <div className="flex items-start justify-between gap-2"><div className="text-[14px] font-semibold text-white leading-tight"><span className="text-white/[0.5] font-normal">Task: </span>{t.title}</div><span className="text-[9.5px] uppercase tracking-wide shrink-0 mt-1" style={{ color: t.status === "done" ? LIME : t.status === "blocked" ? "var(--hx-ff453a)" : t.status === "in_review" ? "var(--hx-ffd60a)" : "var(--hx-a1a1a6)" }}>{t.status.replace("_", " ")}</span></div>
              <People ids={t.assignees} people={graph.people} />
              <Stack items={t.tech_stack} />
              {t.client_approval !== "not_requested" && <div className="mt-2 text-[10.5px]" style={{ color: t.client_approval === "approved" ? LIME : t.client_approval === "rejected" ? "var(--hx-ff453a)" : "var(--hx-ffd60a)" }}>Client approval: {t.client_approval}</div>}
            </div>;
          }
          if (n.kind === "subtasks") {
            const t = graph.tasks.find((x) => x.id === n.ref)!; const open = expanded[n.id] ?? true;
            return <div key={n.id} {...common} className={card(n.id, "px-4 py-3")} onPointerUp={(e) => up(e, { kind: "subtasks", taskId: t.id })}>
              <div className="flex items-center justify-between"><div className="text-[13px] font-semibold text-white">Subtasks: <span className="text-white/[0.5] font-normal">{open ? "List below" : `${t.subtasks.length} hidden`}</span></div><button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setExpanded((x) => ({ ...x, [n.id]: !open })); }} className="text-[11px] text-white/[0.5] hover:text-white">{open ? "Collapse" : "Expand"}</button></div>
              {open && <div className="mt-2 flex flex-col gap-2">{t.subtasks.map((st, i) => <div key={st.id} className="rounded-[10px] px-3 py-2" style={{ background: "rgb(var(--w) / 0.04)", border: "1px solid rgb(var(--w) / 0.08)" }}><div className="text-[12.5px] text-white flex items-center gap-2"><span className={`w-3.5 h-3.5 rounded-[4px] inline-flex items-center justify-center text-[9px] ${st.done ? "text-black" : ""}`} style={{ background: st.done ? LIME : "rgb(var(--w) / 0.08)", border: "1px solid rgb(var(--w) / 0.15)" }}>{st.done ? "✓" : ""}</span><span className={st.done ? "line-through text-white/[0.5]" : ""}>Subtask {i + 1}: {st.title}</span></div>{st.assignees.length > 0 && <People ids={st.assignees} people={graph.people} />}<Stack items={st.tech_stack} /></div>)}</div>}
            </div>;
          }
          if (n.kind === "notes") {
            const list = graph.notes.filter((x) => (n.ref ? x.task_id === n.ref : !x.task_id)); const latest = list[0];
            return <div key={n.id} {...common} className={card(n.id, "px-4 py-3")} onPointerUp={(e) => up(e, { kind: "notes", taskId: n.ref })}>
              <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full inline-flex items-center justify-center" style={{ border: "1.5px solid rgb(var(--w) / 0.5)" }}><span className="w-2 h-2 rounded-full bg-white/[0.7]" /></span><span className="text-[13px] font-semibold text-white">Client Notes</span><span className="text-[11px] ml-auto">{latest && dateLine(latest.updated_at)}</span></div>
              {latest && <div className="mt-2 text-[12px] text-white/[0.65] line-clamp-3">{latest.body}</div>}
              <div className="mt-1.5 text-[10.5px] text-white/[0.35]">{list.length} note{list.length === 1 ? "" : "s"} · click to {readOnly ? "read" : "edit"}</div>
            </div>;
          }
          const r = graph.roles.find((x) => x.id === n.ref)!; const person = r.person_user_id ? graph.people.find((p) => p.id === r.person_user_id) : null; const name = person?.name ?? r.person_name ?? "Unassigned";
          return <div key={n.id} {...common} className={card(n.id, "px-4 py-3.5")} onPointerUp={(e) => up(e, { kind: "role", id: r.id })}>
            <div className="flex items-center gap-3"><Avatar p={person ?? { name, avatar_url: null }} size={34} /><div className="min-w-0"><div className="text-[14px] font-semibold text-white leading-tight truncate">{r.role_title}</div><div className="text-[11.5px] text-white/[0.45] truncate">{r.blurb ?? name}</div></div></div>
            <Stack items={r.tech_stack} />
          </div>;
        })}
      </div>
      <div className="absolute right-3 bottom-3 flex items-center gap-1.5 text-[11px] text-white/[0.45]"><span>drag background to pan · wheel to zoom{readOnly ? "" : " · drag nodes to arrange"}</span></div>
    </div>
  );
}

/** Mobile fallback: the same data as stacked cards. */
export function ProjectCards({ graph, onSelect, readOnly = false }: { graph: Graph; onSelect: (s: Selection) => void; readOnly?: boolean }) {
  const c = graph.client; const btn = "w-full text-left";
  return (
    <div className="flex flex-col gap-3">
      <button type="button" className={`${btn} sfb-glass rounded-[14px] px-4 py-3 flex items-center gap-2`} onClick={() => onSelect({ kind: "client" })}>{c.logo_url ? <img src={c.logo_url} alt="" className="w-6 h-6 rounded-[6px] object-contain bg-white/[0.08]" /> : <span className="w-6 h-6 rounded-[6px] inline-flex items-center justify-center text-[11px] font-bold" style={{ background: LIME, color: "var(--hx-000000)" }}>{initialsOf(c.name)}</span>}<span className="text-[14px] font-semibold text-white">{c.name}</span><span className="ml-auto text-[11px] text-white/[0.4]">Onboarded {fmtDate(c.onboarded_at)}</span></button>
      {graph.tasks.length === 0 && <div className="text-[13px] text-white/[0.45] px-1">No tasks yet.</div>}
      {graph.tasks.map((t) => {
        const notes = graph.notes.filter((n) => n.task_id === t.id); const roles = graph.roles.filter((r) => r.task_id === t.id);
        return <div key={t.id} className="sfb-glass rounded-[14px] px-4 py-3.5">
          <button type="button" className={btn} onClick={() => onSelect({ kind: "task", id: t.id })}><div className="text-[14px] font-semibold text-white"><span className="text-white/[0.5] font-normal">Task: </span>{t.title}</div><People ids={t.assignees} people={graph.people} /><Stack items={t.tech_stack} /></button>
          {t.subtasks.length > 0 && <button type="button" className={`${btn} mt-3 rounded-[10px] px-3 py-2`} style={{ background: "rgb(var(--w) / 0.04)", border: "1px dashed rgba(48,209,88,0.5)" }} onClick={() => onSelect({ kind: "subtasks", taskId: t.id })}><div className="text-[12px] font-semibold text-white">Subtasks</div>{t.subtasks.map((st, i) => <div key={st.id} className={`text-[12px] mt-1 ${st.done ? "line-through text-white/[0.45]" : "text-white/[0.8]"}`}>{i + 1}. {st.title}</div>)}</button>}
          {notes.length > 0 && <button type="button" className={`${btn} mt-2 rounded-[10px] px-3 py-2`} style={{ background: "rgb(var(--w) / 0.04)", border: "1px solid rgb(var(--w) / 0.1)" }} onClick={() => onSelect({ kind: "notes", taskId: t.id })}><div className="text-[12px] font-semibold text-white">Client Notes <span className="text-white/[0.4] font-normal">· {relDate(notes[0].updated_at)}</span></div><div className="text-[12px] text-white/[0.6] line-clamp-2 mt-0.5">{notes[0].body}</div></button>}
          {roles.map((r) => { const person = r.person_user_id ? graph.people.find((p) => p.id === r.person_user_id) : null; const name = person?.name ?? r.person_name ?? "Unassigned"; return <button key={r.id} type="button" className={`${btn} mt-2 rounded-[10px] px-3 py-2 flex items-center gap-2`} style={{ background: "rgb(var(--w) / 0.04)", border: "1px solid rgb(var(--w) / 0.1)" }} onClick={() => onSelect({ kind: "role", id: r.id })}><Avatar p={person ?? { name, avatar_url: null }} size={28} /><div><div className="text-[12.5px] font-semibold text-white">{r.role_title}</div><div className="text-[11px] text-white/[0.45]">{r.blurb ?? name}</div></div></button>; })}
        </div>;
      })}
      {!readOnly && <div className="text-[11px] text-white/[0.35]">Graph view with drag-to-arrange is on desktop.</div>}
    </div>
  );
}

export { nodeId };
