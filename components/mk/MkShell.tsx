import Link from "next/link";
import "./mk.css";
import MkNav from "./MkNav";
import { SUPPORT_EMAIL } from "@/lib/site";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Product", links: [{ href: "/platform", label: "Platform overview" }, { href: "/demo-builder", label: "AI demo builder" }, { href: "/white-label", label: "White-label" }, { href: "/services", label: "Service catalog" }, { href: "/pricing", label: "Pricing" }] },
  { title: "Who it's for", links: [{ href: "/agency-owners", label: "Agency owners" }, { href: "/sales-reps", label: "Sales representatives" }, { href: "/solutions", label: "Industry solutions" }, { href: "/agent", label: "Done-for-you SFB Agent" }] },
  { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/how-it-works", label: "How it works" }, { href: "/resources", label: "Resources" }, { href: "/contact", label: "Contact" }] },
  { title: "Legal", links: [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }, { href: "/login", label: "Log in" }, { href: "/signup", label: "Sign up" }] },
];

export default function MkShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk">
      <MkNav />
      <main>{children}</main>
      <footer style={{ borderTop: "1px solid var(--mk-border)", background: "var(--mk-bg)" }}>
        <div className="max-w-[1180px] mx-auto px-6 py-14 grid gap-10 md:grid-cols-5">
          <div className="md:col-span-1">
            <div className="text-[17px] font-semibold tracking-tight">SFB<span style={{ color: "var(--mk-blue2)" }}>Connect</span></div>
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>The operating system for agencies that sell and deliver AI-powered business systems under their own brand.</p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <div className="text-[12px] uppercase tracking-[0.12em] mb-3" style={{ color: "var(--mk-muted)" }}>{c.title}</div>
              <ul className="flex flex-col gap-2 text-[14px]">{c.links.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-white" style={{ color: "var(--mk-muted)" }}>{l.label}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="max-w-[1180px] mx-auto px-6 pb-10 text-[12.5px] flex flex-wrap gap-x-6 gap-y-2" style={{ color: "var(--mk-muted)" }}>
          <span>Six Figure Blueprints LLC · a RR Empire Co. software division</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">{SUPPORT_EMAIL}</a>
        </div>
      </footer>
    </div>
  );
}
