import Link from "next/link";

export type Cta = { href: string; label: string };
export const PRIMARY: Cta = { href: "/signup", label: "Start Your Agency" };
export const SECONDARY: Cta = { href: "/#demo", label: "Try a Live Demo" };

export function Section({ id, eyebrow, title, lead, children, tint }: { id?: string; eyebrow?: string; title?: string; lead?: string; children?: React.ReactNode; tint?: boolean }) {
  return (
    <section id={id} className="px-6 py-20 md:py-24 scroll-mt-20" style={tint ? { background: "var(--mk-bg2)", borderTop: "1px solid var(--mk-border)", borderBottom: "1px solid var(--mk-border)" } : undefined}>
      <div className="max-w-[1180px] mx-auto">
        {(eyebrow || title) && (
          <div className="max-w-[760px] mb-12">
            {eyebrow && <div className="text-[12px] uppercase tracking-[0.14em] mb-3" style={{ color: "var(--mk-blue2)" }}>{eyebrow}</div>}
            {title && <h2 className="text-[32px] md:text-[44px]">{title}</h2>}
            {lead && <p className="mt-4 text-[16.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>{lead}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageHero({ eyebrow, title, lead, ctas = [PRIMARY, SECONDARY] }: { eyebrow?: string; title: string; lead: string; ctas?: Cta[] }) {
  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mk-hero-glow absolute inset-0" aria-hidden /><div className="mk-grid-bg absolute inset-0" aria-hidden />
      <div className="relative max-w-[900px] mx-auto text-center mk-rise">
        {eyebrow && <span className="mk-chip mb-6">{eyebrow}</span>}
        <h1 className="text-[40px] sm:text-[56px] md:text-[68px] mt-4">{title}</h1>
        <p className="mt-6 text-[17px] md:text-[19px] leading-relaxed max-w-[720px] mx-auto" style={{ color: "var(--mk-muted)" }}>{lead}</p>
        <div className="mt-9 flex flex-wrap gap-3 justify-center">
          {ctas.map((c, i) => <Link key={c.label} href={c.href} className={`mk-btn ${i === 0 ? "mk-btn-primary" : "mk-btn-ghost"}`}>{c.label}</Link>)}
        </div>
      </div>
    </section>
  );
}

export function CardGrid({ items, cols = 3 }: { items: { title: string; body: string; tag?: string }[]; cols?: 2 | 3 | 4 }) {
  const c = cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : cols === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-4 ${c}`}>
      {items.map((it) => (
        <div key={it.title} className="mk-card p-6">
          {it.tag && <span className="mk-chip mb-3">{it.tag}</span>}
          <h3 className="text-[19px] mb-2">{it.title}</h3>
          <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>{it.body}</p>
        </div>
      ))}
    </div>
  );
}

export function Steps({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ol className="grid gap-4 md:grid-cols-4">
      {items.map((s, i) => (
        <li key={s.title} className="mk-card p-6">
          <div className="text-[13px] font-semibold mb-3" style={{ color: "var(--mk-blue2)" }}>0{i + 1}</div>
          <h3 className="text-[20px] mb-2">{s.title}</h3>
          <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="max-w-[820px] flex flex-col gap-3">
      {items.map((f) => (
        <details key={f.q} className="mk-card px-6 py-5 group">
          <summary className="cursor-pointer list-none flex justify-between gap-4 text-[16.5px] font-medium">{f.q}<span style={{ color: "var(--mk-blue2)" }} aria-hidden>+</span></summary>
          <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({ title = "Your agency, your brand, your clients.", lead = "Start your agency, build your first demo, and put it in front of a real business.", ctas = [PRIMARY, { href: "/contact", label: "Talk to us" }] }: { title?: string; lead?: string; ctas?: Cta[] }) {
  return (
    <section className="px-6 py-20">
      <div className="max-w-[1180px] mx-auto rounded-[24px] px-8 py-16 text-center relative overflow-hidden" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)" }}>
        <div className="mk-hero-glow absolute inset-0" aria-hidden />
        <div className="relative">
          <h2 className="text-[30px] md:text-[44px] max-w-[760px] mx-auto">{title}</h2>
          <p className="mt-4 text-[16.5px] max-w-[620px] mx-auto" style={{ color: "var(--mk-muted)" }}>{lead}</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">{ctas.map((c, i) => <Link key={c.label} href={c.href} className={`mk-btn ${i === 0 ? "mk-btn-primary" : "mk-btn-ghost"}`}>{c.label}</Link>)}</div>
        </div>
      </div>
    </section>
  );
}
