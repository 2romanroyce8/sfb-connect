import Link from "next/link";

export default function Navbar() {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[1100px] z-[1000] flex items-center justify-between rounded-[28px] border border-white/10 bg-[#141416]/65 backdrop-blur-2xl px-5 py-3">
      <div className="font-extrabold tracking-tight text-[15px]">
        SFB <span className="text-medium-gray font-semibold">CONNECT</span>
      </div>
      <div className="hidden md:flex gap-8 text-sm text-medium-gray">
        <Link href="#process" className="hover:text-white transition-colors">
          How It Works
        </Link>
        <Link href="#score" className="hover:text-white transition-colors">
          AI Presence
        </Link>
        <Link href="#pricing" className="hover:text-white transition-colors">
          Pricing
        </Link>
      </div>
      <Link
        href="#pricing"
        className="bg-white text-black px-5 py-2 rounded-full text-[13.5px] font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
      >
        Get Started
      </Link>
    </div>
  );
}
