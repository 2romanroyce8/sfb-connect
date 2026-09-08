"use client";

import { useState } from "react";
import Link from "next/link";
import { Linkedin, Twitter, Instagram, ChevronDown, Menu, X } from "lucide-react";

const LOGO_SRC =
  "https://pub.hyperagent.com/api/published/pbf01M20H817H_JC6RBZ3RQ3YAXVV2/sfb_logo_mark_cropped.png";

const SOLUTIONS_LINKS = [
  { label: "AI Presence", href: "/#score" },
  { label: "Website Design", href: "/websites" },
  { label: "Website Rebuilds", href: "/websites#rebuild" },
  { label: "Custom Website Builds", href: "/websites#custom" },
  { label: "Automation", href: "/solutions/automation" },
  { label: "AI Receptionist", href: "/solutions/ai-receptionist" },
  { label: "Marketing", href: "/solutions/marketing" },
  { label: "Paid Ads", href: "/solutions/paid-ads" },
];

const PRIMARY_LINKS = [
  { label: "AI Presence", href: "/#score" },
  { label: "Websites", href: "/websites" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "How It Works", href: "/#process" },
  { label: "Pricing", href: "/#pricing" },
];

export default function Navbar() {
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between px-6 md:px-14 py-5" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(14px)" }}>
      <Link href="/" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="SFB Connect" className="w-7 h-auto shrink-0" />
        <span className="font-extrabold tracking-tight text-[15px]">
          SFB <span className="text-medium-gray font-semibold">CONNECT</span>
        </span>
      </Link>

      <div className="hidden lg:flex items-center gap-6 text-sm">
        <Link href="/#score" className="text-medium-gray hover:text-white transition-colors">
          AI Presence
        </Link>
        <Link href="/websites" className="text-medium-gray hover:text-white transition-colors">
          Websites
        </Link>

        <div className="relative" onMouseEnter={() => setSolutionsOpen(true)} onMouseLeave={() => setSolutionsOpen(false)}>
          <button className="flex items-center gap-1 text-medium-gray hover:text-white transition-colors">
            Solutions <ChevronDown size={13} style={{ transform: solutionsOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          </button>
          {solutionsOpen && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 pt-3"
              style={{ width: 240 }}
            >
              <div className="rounded-[12px] overflow-hidden p-1.5" style={{ background: "#0C0C0C", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
                {SOLUTIONS_LINKS.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="block px-3 py-2.5 rounded-[8px] text-[13px] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link href="/portfolio" className="text-medium-gray hover:text-white transition-colors">
          Portfolio
        </Link>
        <Link href="/#process" className="text-medium-gray hover:text-white transition-colors">
          How It Works
        </Link>
        <Link href="/#pricing" className="text-medium-gray hover:text-white transition-colors">
          Pricing
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          {[Instagram, Linkedin, Twitter].map((Icon, i) => (
            <a
              key={i}
              href="#"
              className="liquid-glass w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/[0.04] transition-colors"
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
            </a>
          ))}
        </div>
        <Link
          href="/#pricing"
          className="hidden sm:inline-flex bg-white text-black px-5 py-2.5 rounded-full text-[13.5px] font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
        >
          Analyze My Business
        </Link>
        <button className="lg:hidden text-white p-1.5" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden fixed top-[72px] left-0 right-0 z-[999] overflow-y-auto"
          style={{ background: "#050505", borderTop: "1px solid rgba(255,255,255,0.08)", maxHeight: "calc(100vh - 72px)" }}
        >
          <div className="px-6 py-6 flex flex-col gap-1">
            {PRIMARY_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="py-3 text-[15px] text-white/80 hover:text-white border-b border-white/[0.06]">
                {l.label}
              </Link>
            ))}
            <div className="pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/35">Solutions</div>
            {SOLUTIONS_LINKS.filter((l) => l.label !== "AI Presence").map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="py-2.5 text-[14px] text-white/65 hover:text-white">
                {l.label}
              </Link>
            ))}
            <Link
              href="/#pricing"
              onClick={() => setMobileOpen(false)}
              className="mt-5 bg-white text-black px-5 py-3 rounded-full text-[14px] font-semibold text-center"
            >
              Analyze My Business
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
