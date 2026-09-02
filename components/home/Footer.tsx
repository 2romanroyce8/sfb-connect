import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-16 pb-10">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="flex justify-between flex-wrap gap-8 mb-12">
          <div className="font-extrabold text-lg">SFB CONNECT</div>
          <div className="flex gap-8 flex-wrap text-sm text-medium-gray">
            <Link href="#process" className="hover:text-white transition-colors">
              How It Works
            </Link>
            <Link href="#score" className="hover:text-white transition-colors">
              AI Presence
            </Link>
            <Link href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="#faq" className="hover:text-white transition-colors">
              FAQ
            </Link>
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
      </div>
    </footer>
  );
}
