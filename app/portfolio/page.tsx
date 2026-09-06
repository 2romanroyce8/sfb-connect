import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/ui/Reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "A selection of websites designed, rebuilt and developed by SFB Connect.",
  alternates: { canonical: "/portfolio" },
};

export default async function PortfolioPage() {
  const supabase = createSupabaseServerClient();
  const { data: projects } = await supabase
    .from("portfolio_projects")
    .select("slug, business_name, industry, location, year, project_type, cover_image_url")
    .eq("published", true)
    .order("sort_order", { ascending: true });

  const list = projects ?? [];

  return (
    <main>
      <Navbar />

      <section className="pt-[140px] pb-16 px-6">
        <div className="max-w-[900px] mx-auto text-center">
          <Reveal>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-6 block">SFB Connect / Selected Work</span>
            <h1 className="text-[36px] sm:text-[48px] md:text-[64px] font-extrabold tracking-[-0.03em] leading-[1.04]">
              Websites built to <span className="font-serif-accent italic font-normal">move businesses forward.</span>
            </h1>
            <p className="mt-6 text-[16px] leading-relaxed text-[#a3a3a8] max-w-[560px] mx-auto">
              A selection of websites designed, rebuilt and developed by SFB Connect.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="pb-28 px-6">
        <div className="max-w-[1180px] mx-auto">
          {list.length === 0 ? (
            <Reveal>
              <div className="rounded-[18px] p-16 text-center max-w-[560px] mx-auto" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-[18px] font-medium text-white mb-2">New work coming soon</div>
                <p className="text-[14px] text-white/45 leading-relaxed">
                  We're building out this portfolio with real client work. Check back soon, or{" "}
                  <a href="/websites#inquiry" className="underline text-white/70 hover:text-white">
                    start a website project
                  </a>{" "}
                  of your own.
                </p>
              </div>
            </Reveal>
          ) : (
            <div className="flex flex-col gap-16">
              {list.map((p, i) => (
                <Reveal key={p.slug}>
                  <Link href={`/portfolio/${p.slug}`} className={`group grid md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                    <div className="rounded-[20px] overflow-hidden border border-white/10 aspect-[16/11] bg-[#0A0A0A]">
                      {p.cover_image_url ? (
                        <img src={p.cover_image_url} alt={p.business_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-[14px]">{p.business_name}</div>
                      )}
                    </div>
                    <div>
                      <span className="inline-flex h-6 px-2.5 items-center rounded-full bg-[#141414] border border-white/10 text-[10px] font-medium tracking-wide text-white/50 uppercase mb-4">
                        {p.project_type.replace(/_/g, " ")}
                      </span>
                      <div className="text-[26px] md:text-[34px] font-semibold tracking-[-0.02em] text-white mb-2">{p.business_name}</div>
                      <div className="text-[13.5px] text-white/40 mb-5">
                        {[p.industry, p.location, p.year].filter(Boolean).join(" · ")}
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-white">
                        View project <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
