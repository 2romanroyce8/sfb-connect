import Link from "next/link";
import { Instagram } from "lucide-react";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.5 3c.3 2.4 1.9 4.1 4.3 4.3v3.2c-1.6 0-3.1-.5-4.3-1.4v6.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.3a2.4 2.4 0 1 0 1.5 2.2V3h3.2Z" />
    </svg>
  );
}
const SOCIALS = [
  { label: "TikTok", href: "https://www.tiktok.com/@roman.aeo", Icon: TikTokIcon },
  { label: "Instagram", href: "https://www.instagram.com/roman.aeo", Icon: Instagram },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-16 pb-10">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="flex justify-between flex-wrap gap-8 mb-12">
          <div className="font-extrabold text-lg">SFB CONNECT</div>
          <div className="flex gap-8 flex-wrap text-sm text-medium-gray">
            <Link href="/agent" className="hover:text-white transition-colors">
              SFB Agent
            </Link>
            <Link href="/#score" className="hover:text-white transition-colors">
              AI Presence
            </Link>
            <Link href="/#pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-white transition-colors">
              FAQ
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Customer sign in
            </Link>
            {/* Legal pages render Muse's drafts from lib/legal/documents.ts once every open item is resolved; placeholders until then. */}
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {SOCIALS.map(({ label, href, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`SFB Connect on ${label}`} className="w-9 h-9 rounded-full flex items-center justify-center text-medium-gray hover:text-white transition-colors" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
        <div className="flex justify-between flex-wrap gap-4 text-[12.5px] text-[#5c5c60] pt-8 border-t border-white/10">
          <div className="max-w-[640px] leading-relaxed">
            AI recommendations are dynamic and can vary based on platform,
            query, user, location, available sources and other factors. SFB
            Connect improves AI discoverability and business information
            quality but does not guarantee a specific ranking or
            recommendation.
          </div>
          <div>© 2026 SFB Connect. All rights reserved.</div>
        </div>
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-[12.5px] text-[#5c5c60] max-w-[640px] leading-relaxed">
            SFB Connect is not affiliated with, certified by, or partnered
            with the platforms named above. Logos and names are shown to
            describe the discovery ecosystem this service addresses.
          </p>
        </div>
      </div>
    </footer>
  );
}
