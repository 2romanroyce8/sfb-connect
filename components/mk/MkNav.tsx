"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export const NAV_LINKS = [
  { href: "/#demo", label: "Demo" }, { href: "/demo-builder", label: "Build it" }, { href: "/platform", label: "Platform" }, { href: "/pricing", label: "Pricing" },
  { href: "/services", label: "Services" }, { href: "/how-it-works", label: "How it works" }, { href: "/resources", label: "Resources" },
];

export default function MkNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="mk-pill-nav" style={{ padding: "0 12px 0 22px" }}>
      <div className="h-[62px] flex items-center gap-7">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
          <span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "var(--mk-ink)" }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src="https://pub.hyperagent.com/api/published/pbf01M20H817H_JC6RBZ3RQ3YAXVV2/sfb_logo_mark_cropped.png" alt="" className="w-[18px] h-auto" /></span>
          <span>SFB<span style={{ color: "var(--mk-blue2)" }}>Connect</span></span>
        </Link>
        <nav className="hidden lg:flex items-center gap-6 text-[14.5px]" style={{ color: "var(--mk-muted)" }} aria-label="Main">
          {NAV_LINKS.map((l) => <Link key={l.label} href={l.href} className="hover:text-black transition-colors">{l.label}</Link>)}
        </nav>
        <div className="ml-auto hidden lg:flex items-center gap-2">
          <Link href="/signup" className="mk-btn mk-btn-primary" style={{ height: 42, fontSize: 14 }}>Start Your Agency</Link>
          <Link href="/login" className="mk-btn mk-btn-ghost" style={{ height: 42, fontSize: 14 }}>Sign in</Link>
        </div>
        <button className="ml-auto lg:hidden p-2" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {open && (
        <div className="lg:hidden pb-5 flex flex-col gap-1" style={{ borderTop: "1px solid var(--mk-border)" }}>
          {NAV_LINKS.map((l) => <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="py-3 text-[15.5px]">{l.label}</Link>)}
          <Link href="/login" onClick={() => setOpen(false)} className="py-3 text-[15.5px]" style={{ color: "var(--mk-muted)" }}>Sign in</Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="mk-btn mk-btn-primary mt-2">Start Your Agency</Link>
        </div>
      )}
    </header>
  );
}
