"use client";

import { useState } from "react";
import Link from "next/link";
import { Linkedin, Twitter, Instagram, Menu, X } from "lucide-react";

// Real profile URLs only. A null entry hides the icon -- a social button that
// goes nowhere is worse than no button for a company selling discoverability.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.5 3c.3 2.4 1.9 4.1 4.3 4.3v3.2c-1.6 0-3.1-.5-4.3-1.4v6.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.3a2.4 2.4 0 1 0 1.5 2.2V3h3.2Z" />
    </svg>
  );
}
type SocialIcon = React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
const SOCIAL_LINKS: { label: string; href: string | null; Icon: SocialIcon }[] = [
  { label: "Instagram", href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || "https://www.instagram.com/roman.aeo", Icon: Instagram },
  { label: "TikTok", href: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK || "https://www.tiktok.com/@roman.aeo", Icon: TikTokIcon },
  { label: "LinkedIn", href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN || null, Icon: Linkedin },
  { label: "X", href: process.env.NEXT_PUBLIC_SOCIAL_X || null, Icon: Twitter },
];

const LOGO_SRC =
  "https://pub.hyperagent.com/api/published/pbf01M20H817H_JC6RBZ3RQ3YAXVV2/sfb_logo_mark_cropped.png";

const PRIMARY_LINKS = [
  { label: "Agent", href: "/#agent" },
  { label: "AI Presence", href: "/#score" },
  { label: "How It Works", href: "/#process" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

export default function Navbar() {
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
        {PRIMARY_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-medium-gray hover:text-white transition-colors">
            {l.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          {SOCIAL_LINKS.filter((s) => s.href).map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`SFB Connect on ${label}`}
              className="liquid-glass w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/[0.04] transition-colors"
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
            </a>
          ))}
        </div>
        <Link href="/login" className="hidden sm:inline-flex text-[13.5px] text-medium-gray hover:text-white transition-colors whitespace-nowrap">
          Sign in
        </Link>
        <Link
          href="/start"
          className="hidden sm:inline-flex bg-white text-black px-5 py-2.5 rounded-full text-[13.5px] font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
        >
          Try it free
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
            <Link href="/login" onClick={() => setMobileOpen(false)} className="py-3 text-[15px] text-white/80 hover:text-white border-b border-white/[0.06]">
              Sign in
            </Link>
            <Link
              href="/start"
              onClick={() => setMobileOpen(false)}
              className="mt-5 bg-white text-black px-5 py-3 rounded-full text-[14px] font-semibold text-center"
            >
              Try it free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
