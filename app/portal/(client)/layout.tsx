import Link from "next/link";
import { redirect } from "next/navigation";
import "@/components/mk/mk.css";
import { getPortalContext } from "@/lib/agency/portalContext";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const r = await getPortalContext();
  if (r.status === "anon") redirect("/login?next=/portal");
  if (r.status === "no_client") return <div className="mk"><main className="px-6 py-28 max-w-[560px] mx-auto text-center"><h1 className="text-[34px]">No client portal on this login</h1><p className="mt-4 text-[16px]" style={{ color: "var(--mk-muted)" }}>This sign-in ({r.email}) isn&apos;t linked to a client yet. Open the invite link your agency sent you, using this email address.</p></main></div>;
  const style = r.ctx.brand.color ? ({ ["--mk-blue" as string]: r.ctx.brand.color, ["--mk-blue2" as string]: r.ctx.brand.color } as React.CSSProperties) : undefined;
  return (
    <div className="mk" style={style}>
      <header className="px-6 h-[68px] flex items-center gap-3 max-w-[1000px] mx-auto">
        {r.ctx.brand.logoUrl // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.ctx.brand.logoUrl} alt={`${r.ctx.brand.name} logo`} className="h-8 w-auto" /> : null}
        <span className="text-[17px] font-semibold tracking-tight mr-auto">{r.ctx.brand.name}</span>
        <nav className="flex gap-5 text-[14px]" style={{ color: "var(--mk-muted)" }} aria-label="Portal"><Link href="/portal" className="hover:text-black">Overview</Link><Link href="/portal/onboarding" className="hover:text-black">Onboarding</Link></nav>
      </header>
      <main className="px-5 pb-20 pt-8 max-w-[1000px] mx-auto">{children}</main>
      <footer className="text-center text-[12.5px] pb-10" style={{ color: "var(--mk-muted)" }}>Portal by {r.ctx.brand.name}, powered by <a href="https://www.sfbconnect.com" className="underline">SFB Connect</a></footer>
    </div>
  );
}
