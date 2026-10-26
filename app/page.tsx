import type { Metadata } from "next";
import Link from "next/link";
import MkShell from "@/components/mk/MkShell";
import DemoStage from "@/components/mk/DemoStage";
import { PageHero, Section, CardGrid, Steps, Faq, CtaBand } from "@/components/mk/MkParts";
import { HOME_STEPS, WORKSPACE, INDUSTRIES, PORTAL, SERVICES, AUDIENCES, HOME_FAQ } from "@/components/mk/content";

export const metadata: Metadata = {
  title: "SFB Connect: Your Agency. Your Brand. Your Clients. One Operating System.",
  description: "Build interactive AI demonstrations, close software deals, manage clients, and deliver AI-powered business systems through one platform.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <MkShell>
      <PageHero eyebrow="The operating system for AI agencies" title="Your Agency. Your Brand. Your Clients. One Operating System."
        lead="Build interactive AI demonstrations, close software deals, manage clients, and deliver AI-powered business systems through one platform." />
      <Section id="demo" eyebrow="Try it yourself" title="This is what your prospect opens, under your brand." lead="Switch the trade and try each module. These panels are scripted simulations so you can feel the experience; inside your workspace, demos run on a real business's own details.">
        <DemoStage />
      </Section>
      <Section tint eyebrow="The workflow" title="Build. Brand. Publish. Sell."><Steps items={HOME_STEPS} /></Section>
      <Section eyebrow="Agency workspace" title="Everything an agency runs on, in one place." lead="The demo builder is live today. The rest of the workspace is being added, and each card says where it stands."><CardGrid items={WORKSPACE} /></Section>
      <Section tint eyebrow="Industry demonstrations" title="Start from a configuration that already knows the trade." lead="Each industry comes with typical services, common customer questions and qualifying questions. More can be added without code.">
        <div className="flex flex-wrap gap-2">{INDUSTRIES.map((i) => <span key={i} className="mk-chip" style={{ fontSize: 13.5, padding: "7px 16px" }}>{i}</span>)}</div>
        <p className="mt-5 text-[13.5px]" style={{ color: "var(--mk-muted)" }}>{INDUSTRIES.length} industries today, plus an industry-neutral fallback.</p>
      </Section>
      <Section eyebrow="Fulfillment and client portal" title="Then deliver it, without rebuilding from scratch." lead="Coming next: orders that move from quote to live, with a client portal your customer can follow."><CardGrid items={PORTAL} /></Section>
      <Section tint eyebrow="Service catalog" title="Fifteen kinds of work you can sell." lead="The catalog shows what you will be able to order. Ordering and wholesale quotes open in the workspace next.">
        <CardGrid items={SERVICES.slice(0, 6)} />
        <div className="mt-8"><Link href="/services" className="mk-btn mk-btn-ghost">See the full catalog</Link></div>
      </Section>
      <Section eyebrow="Pricing" title="$49 a month for the platform." lead="Billing is not switched on yet, so creating a workspace is free for now. Client builds will be quoted at wholesale; whatever you charge above that is your margin.">
        <div className="flex flex-wrap gap-3"><Link href="/pricing" className="mk-btn mk-btn-primary">See pricing</Link><Link href="/resources" className="mk-btn mk-btn-ghost">Open the pricing calculator</Link></div>
      </Section>
      <Section tint eyebrow="Built for" title="Agency owners and the people who sell for them.">
        <div className="grid gap-4 md:grid-cols-2">{AUDIENCES.map((a) => (
          <Link key={a.href} href={a.href} className="mk-card p-7 block"><h3 className="text-[22px] mb-2">{a.title}</h3><p className="text-[15px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>{a.body}</p><span className="inline-block mt-4 text-[14px]" style={{ color: "var(--mk-blue2)" }}>Learn more →</span></Link>))}</div>
      </Section>
      <Section eyebrow="Prefer it done for you?" title="Meet the SFB Agent." lead="One AI agent with a human overseer that runs outbound, follow-up, your website and more for your own business. Same company, different product.">
        <div className="flex flex-wrap gap-3 justify-center"><Link href="/agent" className="mk-btn mk-btn-primary">See the SFB Agent</Link><Link href="/start" className="mk-btn mk-btn-ghost">Check my business</Link></div>
      </Section>
      <Section eyebrow="Client acquisition" title="From a cold prospect to a signed client.">
        <Steps items={[{ title: "Find", body: "Research businesses in your market from public sources and keep the evidence." }, { title: "Demo", body: "Send a personalized demo link built for that business." }, { title: "Follow up", body: "Track views and replies, then move the deal through your pipeline." }, { title: "Close", body: "Quote the build, onboard the client and start fulfillment." }]} />
      </Section>
      <Section tint eyebrow="FAQ" title="Straight answers."><Faq items={HOME_FAQ} /></Section>
      <CtaBand />
    </MkShell>
  );
}
