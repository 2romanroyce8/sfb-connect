import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, ArrowLeft } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/ui/Reveal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CaseStudy = { client?: string; challenge?: string; approach?: string; build?: string; delivered?: string; aiPresence?: string };

async function getProject(slug: string) {
  const supabase = createSupabaseServerClient();
  const { data: project } = await supabase.from("portfolio_projects").select("*").eq("slug", slug).eq("published", true).single();
  if (!project) return null;

  const [{ data: services }, { data: media }, { data: results }] = await Promise.all([
    supabase.from("portfolio_services").select("service").eq("project_id", project.id),
    supabase.from("portfolio_media").select("type, url, alt_text, sort_order").eq("project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("portfolio_results").select("metric, value, description").eq("project_id", project.id).eq("verified", true),
  ]);

  return { project, services: services ?? [], media: media ?? [], results: results ?? [] };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getProject(params.slug);
  if (!data) return {};
  const { project } = data;
  return {
    title: project.business_name,
    description: project.short_description || `${project.business_name} — a ${project.project_type.replace(/_/g, " ").toLowerCase()} project by SFB Connects.`,
    alternates: { canonical: `/portfolio/${project.slug}` },
    openGraph: project.cover_image_url ? { images: [{ url: project.cover_image_url }] } : undefined,
  };
}

export default async function PortfolioProjectPage({ params }: { params: { slug: string } }) {
  const data = await getProject(params.slug);
  if (!data) notFound();
  const { project, services, media, results } = data;
  const caseStudy: CaseStudy = project.case_study || {};

  const desktopShots = media.filter((m) => m.type === "desktop" || m.type === "cover");
  const mobileShots = media.filter((m) => m.type === "mobile");
  const detailShots = media.filter((m) => m.type === "detail");

  return (
    <main>
      <Navbar />

      <section className="pt-[140px] pb-14 px-6">
        <div className="max-w-[1100px] mx-auto">
          <Reveal>
            <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-[13px] text-white/45 hover:text-white mb-8">
              <ArrowLeft size={13} /> All Work
            </Link>
            <span className="inline-flex h-6 px-2.5 items-center rounded-full bg-[#141414] border border-white/10 text-[10px] font-medium tracking-wide text-white/50 uppercase mb-5">
              {project.project_type.replace(/_/g, " ")}
            </span>
            <h1 className="text-[36px] sm:text-[48px] md:text-[60px] font-extrabold tracking-[-0.03em] leading-[1.02] mb-4">{project.business_name}</h1>
            <div className="text-[14px] text-white/40">{[project.industry, project.location, project.year].filter(Boolean).join(" · ")}</div>
          </Reveal>

          {desktopShots[0] && (
            <Reveal>
              <div className="mt-10 rounded-[20px] overflow-hidden border border-white/10">
                <img src={desktopShots[0].url} alt={desktopShots[0].alt_text || project.business_name} className="w-full object-cover" />
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="max-w-[820px] mx-auto flex flex-col gap-14">
          {caseStudy.client && <CaseBlock label="The Client" text={caseStudy.client} />}
          {caseStudy.challenge && <CaseBlock label="The Challenge" text={caseStudy.challenge} />}
          {caseStudy.approach && <CaseBlock label="The Approach" text={caseStudy.approach} />}
          {caseStudy.build && <CaseBlock label="The Build" text={caseStudy.build} />}
          {caseStudy.delivered && <CaseBlock label="What SFB Delivered" text={caseStudy.delivered} />}

          {services.length > 0 && (
            <Reveal>
              <div>
                <div className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-4">Services Provided</div>
                <div className="flex flex-wrap gap-2">
                  {services.map((s, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-[12.5px] text-white/70" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {s.service}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {results.length > 0 && (
            <Reveal>
              <div>
                <div className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-4">Results</div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {results.map((r, i) => (
                    <div key={i} className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="text-[26px] font-semibold text-white">{r.value}</div>
                      <div className="text-[12px] text-white/45 mt-1">{r.metric}</div>
                      {r.description && <div className="text-[11.5px] text-white/30 mt-2">{r.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {caseStudy.aiPresence && (
            <Reveal>
              <div className="rounded-[14px] p-6" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-3">AI Presence</div>
                <p className="text-[14px] leading-relaxed text-white/70">{caseStudy.aiPresence}</p>
              </div>
            </Reveal>
          )}

          {project.website_url && (
            <Reveal>
              <a
                href={project.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-[46px] px-5 rounded-full bg-white text-black text-[14px] font-semibold w-fit"
              >
                View Live Website <ExternalLink size={14} />
              </a>
            </Reveal>
          )}

          {(mobileShots.length > 0 || detailShots.length > 0 || desktopShots.length > 1) && (
            <Reveal>
              <div>
                <div className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-4">Gallery</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[...desktopShots.slice(1), ...detailShots, ...mobileShots].map((m, i) => (
                    <div key={i} className="rounded-[14px] overflow-hidden border border-white/10">
                      <img src={m.url} alt={m.alt_text || project.business_name} className="w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

function CaseBlock({ label, text }: { label: string; text: string }) {
  return (
    <Reveal>
      <div>
        <div className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-3">{label}</div>
        <p className="text-[16px] leading-relaxed text-white/75 max-w-[720px]">{text}</p>
      </div>
    </Reveal>
  );
}
