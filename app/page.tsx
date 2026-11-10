import type { Metadata } from "next";
import Link from "next/link";
import DemoStage from "@/components/mk/DemoStage";
import { HOME_FAQ, PORTAL, SERVICES, WORKSPACE } from "@/components/mk/content";
import { LOGO_MARK } from "@/lib/brand";
import "@/components/mk/mk.css";
import "./home-redesign.css";

export const metadata: Metadata = {
  title: "SFB Connect | The operating system for AI agencies",
  description: "Build interactive AI demos, close software deals, and deliver AI-powered business systems under your own brand.",
  alternates: { canonical: "/" },
};

const navigation = [
  ["Home", "#hero"],
  ["About", "#about"],
  ["Features", "#features"],
  ["Platform", "#platform"],
  ["Get started", "#start"],
];

export default function HomePage() {
  return (
    <div className="sfb-launch">
      <header className="sfb-launch-nav">
        <Link href="/" aria-label="SFB Connect home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK} alt="" width={48} height={48} />
        </Link>
        <nav aria-label="Homepage">{navigation.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
        <Link className="sfb-launch-login" href="/login">Sign in</Link>
      </header>

      <main>
        <section id="hero" className="sfb-launch-hero">
          <div className="sfb-launch-title">
            <h1>SFB Connect</h1>
            <div className="sfb-launch-console" aria-hidden="true">
              <div className="sfb-launch-screen">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_MARK} alt="" width={42} height={42} />
              </div>
              <span />
            </div>
          </div>
          <p>Your agency. Your brand. Your clients. One operating system.</p>
          <a className="sfb-launch-button" href="#about">Explore SFB Connect <span aria-hidden="true">↘</span></a>
        </section>

        <section id="about" className="sfb-launch-section sfb-launch-about">
          <p className="sfb-launch-label">About the platform</p>
          <h2>Build an AI agency under your own brand.</h2>
          <p>Give prospects a demo built for their business, manage the sale, and deliver AI-powered systems from one workspace.</p>
        </section>

        <section id="demo" className="sfb-launch-section sfb-launch-demo">
          <p className="sfb-launch-label">Interactive demo</p>
          <h2>See what your prospect opens.</h2>
          <div className="mk"><DemoStage sideBySide /></div>
        </section>

        <section id="features" className="sfb-launch-section">
          <p className="sfb-launch-label">Features</p>
          <h2>From first demo to client delivery.</h2>
          <ol className="sfb-launch-features">
            {SERVICES.map(({ title, body }, index) => (
              <li key={title}>
                <span className="sfb-launch-label">{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{title}</h3><p>{body}</p></div>
              </li>
            ))}
          </ol>
          <Link className="sfb-launch-button" href="/services">See the service catalog <span aria-hidden="true">↗</span></Link>
        </section>

        <section id="platform" className="sfb-launch-section">
          <p className="sfb-launch-label">Platform</p>
          <h2>One workspace for your agency.</h2>
          <div className="sfb-launch-grid">
            {[...WORKSPACE, ...PORTAL].map(({ title, body, tag }) => (
              <article key={title}>
                <span className="sfb-launch-label">{tag || "Client portal"}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <Link className="sfb-launch-button" href="/platform">Explore the platform <span aria-hidden="true">↗</span></Link>
        </section>

        <section className="sfb-launch-section sfb-launch-faq">
          <p className="sfb-launch-label">FAQ</p>
          <h2>Frequently asked questions.</h2>
          {HOME_FAQ.map(({ q, a }) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </section>

        <section id="start" className="sfb-launch-section sfb-launch-start">
          <p className="sfb-launch-label">Get started</p>
          <h2>Start your agency.</h2>
          <p>Build your first demo and put it in front of a real business.</p>
          <Link className="sfb-launch-button" href="/signup">Create a workspace <span aria-hidden="true">↗</span></Link>
          <div className="flex flex-wrap justify-center gap-5 underline">
            <Link href="/pricing">See pricing</Link>
            <Link href="/book">Book a walkthrough</Link>
          </div>
        </section>
      </main>

      <footer className="sfb-launch-footer">
        <span>© {new Date().getFullYear()} Six Figure Blueprints LLC</span>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms of service</Link>
      </footer>
    </div>
  );
}
