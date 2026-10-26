import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/components/mk/mk.css";
import PublicDemo from "@/components/agency/PublicDemo";
import { getPublicDemo, demoToTrade } from "@/lib/agency/demoPublic";
export const dynamic = "force-dynamic";

// A published demo, branded as the AGENCY (not SFB Connect). Drafts and unknown links are a plain 404. Not indexed: these are private sales links.
export async function generateMetadata({ params }: { params: { agency: string; slug: string } }): Promise<Metadata> {
  const d = await getPublicDemo(params.agency, params.slug);
  return { title: d ? `${d.businessName} — AI demo by ${d.brand.name}` : "Demo not found", robots: { index: false, follow: false } };
}
export default async function DemoPage({ params }: { params: { agency: string; slug: string } }) {
  const d = await getPublicDemo(params.agency, params.slug); if (!d) notFound();
  const cta = d.brand.bookingUrl ? { href: d.brand.bookingUrl, label: "Book a call" } : d.brand.contactEmail ? { href: `mailto:${d.brand.contactEmail}?subject=${encodeURIComponent(`About the ${d.businessName} demo`)}`, label: "Contact us" } : null;
  const style = d.brand.color ? ({ ["--mk-blue" as string]: d.brand.color, ["--mk-blue2" as string]: d.brand.color } as React.CSSProperties) : undefined;
  return (
    <div className="mk" style={style}>
      <header className="px-6 h-[68px] flex items-center gap-3 max-w-[1100px] mx-auto">
        {d.brand.logoUrl // eslint-disable-next-line @next/next/no-img-element
          ? <img src={d.brand.logoUrl} alt={`${d.brand.name} logo`} className="h-8 w-auto" /> : null}
        <span className="text-[17px] font-semibold tracking-tight">{d.brand.name}</span>
      </header>
      <main className="px-5 pb-20 pt-6 max-w-[1100px] mx-auto">
        <div className="text-center max-w-[780px] mx-auto mb-10">
          <span className="mk-chip mb-5">A personalized demo</span>
          <h1 className="text-[40px] sm:text-[60px] mt-4">What an AI assistant could do for {d.businessName}.</h1>
          <p className="mt-6 text-[17px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>Prepared by {d.brand.name}{d.pack ? ` for ${d.pack.name.toLowerCase()}` : ""}. Try each part below. Simulated parts are labeled.</p>
          {d.pack && d.pack.services.length > 0 && <div className="mt-6 flex flex-wrap gap-2 justify-center">{d.pack.services.map((s) => <span key={s} className="mk-chip">{s}</span>)}</div>}
        </div>
        <PublicDemo agency={d.agencySlug} slug={d.slug} trade={demoToTrade(d)} cta={cta} />
      </main>
      <footer className="text-center text-[12.5px] pb-10" style={{ color: "var(--mk-muted)" }}>Powered by <a href="https://www.sfbconnect.com" className="underline">SFB Connect</a></footer>
    </div>
  );
}
