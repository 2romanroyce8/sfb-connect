"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export const NAV_LINKS = [
  { href: "/platform", label: "Platform" }, { href: "/demo-builder", label: "Demo Builder" }, { href: "/solutions", label: "Solutions" },
  { href: "/services", label: "Services" }, { href: "/pricing", label: "Pricing" }, { href: "/how-it-works", label: "How it works" }, { href: "/resources", label: "Resources" },
];

export default function MkNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50" style={{ background: "color-mix(in srgb, var(--mk-bg) 88%, transparent)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--mk-border)" }}>
      <div className="max-w-[1180px] mx-auto px-6 h-[68px] flex items-center gap-8">
        <Link href="/" className="text-[17px] font-semibold tracking-tight">SFB<span style={{ color: "var(--mk-blue2)" }}>Connect</span></Link>
        <nav className="hidden lg:flex items-center gap-6 text-[14px]" style={{ color: "var(--mk-muted)" }} aria-label="Main">
          {NAV_LINKS.map((l) => <Link key={l.href} href={l.href} className="hover:text-white transition-colors">{l.label}</Link>)}
        </nav>
        <div className="ml-auto hidden lg:flex items-center gap-3">
          <Link href="/login" className="text-[14px]" style={{ color: "var(--mk-muted)" }}>Log in</Link>
          <Link href="/signup" className="mk-btn mk-btn-primary" style={{ height: 40 }}>Start Your Agency</Link>
        </div>
        <button className="ml-auto lg:hidden p-2" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {open && (
        <div className="lg:hidden px-6 pb-6 flex flex-col gap-1" style={{ borderTop: "1px solid var(--mk-border)" }}>
          {NAV_LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3 text-[15px]">{l.label}</Link>)}
          <Link href="/login" onClick={() => setOpen(false)} className="py-3 text-[15px]" style={{ color: "var(--mk-muted)" }}>Log in</Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="mk-btn mk-btn-primary mt-2">Start Your Agency</Link>
        </div>
      )}
    </header>
  );
}
