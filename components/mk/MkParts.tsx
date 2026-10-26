import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export type Cta = { href: string; label: string };
export const PRIMARY: Cta = { href: "/signup", label: "Start Your Agency" };
export const SECONDARY: Cta = { href: "/#demo", label: "Try a Live Demo" };

export function Section({ id, eyebrow, title, lead, children, tint }: { id?: string; eyebrow?: string; title?: string; lead?: string; children?: React.ReactNode; tint?: boolean }) {
  return (
    <section id={id} className="px-5 py-20 md:py-28 scroll-mt-24" style={tint ? { background: "var(--mk-bg2)" } : undefined}>
      <div className="max-w-[1180px] mx-auto">
        {(eyebrow || title) && (
          <div className="max-w-[820px] mx-auto text-center mb-14">
            {eyebrow && <span className="mk-chip mb-6">{eyebrow}</span>}
            {title && <h2 className="text-[38px] sm:text-[52px] md:text-[60px] mt-4">{title}</h2>}
            {lead && <p className="mt-5 text-[17px] md:text-[18.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>{lead}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageHero({ eyebrow, title, lead, ctas = [PRIMARY, SECONDARY], children }: { eyebrow?: string; title: string; lead: string; ctas?: Cta[]; children?: React.ReactNode }) {
  return (
    <section className="px-5 pt-[150px] pb-16 md:pt-[180px] md:pb-24">
      <div className="max-w-[1000px] mx-auto text-center mk-rise">
        {eyebrow && <span className="mk-chip mb-8"><Sparkles size={14} style={{ color: "var(--mk-blue)" }} aria-hidden />{eyebrow}</span>}
        <h1 className="text-[46px] sm:text-[68px] md:text-[88px] mt-5">{title}</h1>
        <p className="mt-8 text-[17px] md:text-[20px] leading-relaxed max-w-[720px] mx-auto" style={{ color: "var(--mk-muted)" }}>{lead}</p>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          {ctas.map((c, i) => <Link key={c.label} href={c.href} className={`mk-btn ${i === 0 ? "mk-btn-primary" : "mk-btn-ghost"}`}>{c.label}{i === 0 && <ArrowRight size={16} aria-hidden />}</Link>)}
        </div>
      </div>
      {children}
    </section>
  );
}

export function CardGrid({ items, cols = 3 }: { items: { title: string; body: string; tag?: string }[]; cols?: 2 | 3 | 4 }) {
  const c = cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : cols === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-5 ${c}`}>
      {items.map((it) => (
        <div key={it.title} className="mk-card p-7">
          {it.tag && <span className="mk-chip mb-3">{it.tag}</span>}
          <h3 className="text-[21px] mb-2.5">{it.title}</h3>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>{it.body}</p>
        </div>
      ))}
    </div>
  );
}

/** Four dark rounded "bento" cards (wide/narrow, then narrow/wide). Used for the Build / Brand / Publish / Sell style flows. */
export function Steps({ items }: { items: { title: string; body: string }[] }) {
  const span = ["md:col-span-3", "md:col-span-2", "md:col-span-2", "md:col-span-3"];
  return (
    <ol className="grid gap-5 md:grid-cols-5">
      {items.map((s, i) => (
        <li key={s.title} className={`mk-dark p-8 md:p-10 min-h-[260px] flex flex-col ${span[i % 4]}`}>
          <div className="text-[13px] font-semibold tracking-[0.14em] mb-5" style={{ color: "var(--mk-ink-muted)" }}>0{i + 1}</div>
          <h3 className="text-[34px] md:text-[44px]" style={{ fontWeight: 500 }}>{s.title}</h3>
          <p className="mt-4 text-[15.5px] leading-relaxed max-w-[460px]">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="max-w-[820px] mx-auto flex flex-col gap-3">
      {items.map((f) => (
        <details key={f.q} className="mk-card px-7 py-5">
          <summary className="cursor-pointer list-none flex justify-between gap-4 text-[17px] font-medium">{f.q}<span style={{ color: "var(--mk-blue)" }} aria-hidden>+</span></summary>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({ title = "Your agency, your brand, your clients.", lead = "Start your agency, build your first demo, and put it in front of a real business.", ctas = [PRIMARY, { href: "/contact", label: "Talk to us" }] }: { title?: string; lead?: string; ctas?: Cta[] }) {
  return (
    <section className="px-5 py-20">
      <div className="max-w-[1180px] mx-auto mk-dark px-8 py-20 text-center" style={{ borderRadius: 36 }}>
        <h2 className="text-[34px] md:text-[56px] max-w-[820px] mx-auto">{title}</h2>
        <p className="mt-5 text-[17px] max-w-[620px] mx-auto">{lead}</p>
        <div className="mt-9 flex flex-wrap gap-3 justify-center">
          {ctas.map((c, i) => <Link key={c.label} href={c.href} className="mk-btn" style={i === 0 ? { background: "var(--mk-white)", color: "var(--mk-ink)" } : { border: "1px solid var(--mk-ink-line)", color: "var(--mk-white)" }}>{c.label}</Link>)}
        </div>
      </div>
    </section>
  );
}
