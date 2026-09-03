import Link from "next/link";
import { Linkedin, Twitter, Instagram } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between px-6 md:px-14 py-5">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full border-2 border-white/60 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full border border-white/60" />
        </div>
        <span className="font-extrabold tracking-tight text-[15px]">
          SFB <span className="text-medium-gray font-semibold">CONNECT</span>
        </span>
      </div>

      <div className="hidden md:flex items-center gap-3 text-sm">
        <Link href="#process" className="text-medium-gray hover:text-white transition-colors">
          How It Works
        </Link>
        <span className="text-white/25">•</span>
        <Link href="#score" className="text-medium-gray hover:text-white transition-colors">
          AI Presence
        </Link>
        <span className="text-white/25">•</span>
        <Link href="#pricing" className="text-medium-gray hover:text-white transition-colors">
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
          href="#pricing"
          className="bg-white text-black px-5 py-2.5 rounded-full text-[13.5px] font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
        >
          Get Started
        </Link>
      </div>
    </nav>
  );
}
