import Link from "next/link";
import { getPortalContext } from "@/lib/agency/portalContext";
import { progress } from "@/lib/agency/onboarding";

const STATUS: Record<string, { label: string; next: string }> = {
  draft: { label: "Not submitted yet", next: "Fill in your onboarding so we can start building." },
  submitted: { label: "Submitted — under review", next: "Your agency is reviewing your answers. You'll see the result here." },
  changes_requested: { label: "Changes requested", next: "Your agency asked for a few changes. Open onboarding to see what to update." },
  approved: { label: "Approved", next: "Your onboarding is approved. Your agency will be in touch about the next steps." },
};
export default async function PortalHome() {
  const r = await getPortalContext(); if (r.status !== "ok") return null;
  const o = r.ctx.onboarding; const st = STATUS[o.status] ?? STATUS.draft; const p = progress(o.answers);
  return (
    <div>
      <h1 className="text-[40px] sm:text-[52px]">Welcome, {r.ctx.client.name}.</h1>
      <p className="mt-4 text-[17px]" style={{ color: "var(--mk-muted)" }}>This is your space with {r.ctx.brand.name}. Only you and your agency can see it.</p>
      <div className="mk-card p-7 mt-8">
        <div className="text-[12px] uppercase tracking-[0.12em]" style={{ color: "var(--mk-muted)" }}>Onboarding</div>
        <div className="text-[24px] font-semibold mt-2">{st.label}</div>
        <p className="mt-2 text-[15px]" style={{ color: "var(--mk-muted)" }}>{st.next}</p>
        {o.status === "changes_requested" && o.review_note && <div className="mt-4 rounded-[12px] px-4 py-3 text-[14.5px]" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)" }}><strong>From your agency:</strong> {o.review_note}</div>}
        {(o.status === "draft" || o.status === "changes_requested") && <div className="mt-5"><div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--mk-bg2)" }}><div className="h-full" style={{ width: `${Math.round((p.done / p.total) * 100)}%`, background: "var(--mk-blue)" }} /></div><div className="text-[12.5px] mt-1.5" style={{ color: "var(--mk-muted)" }}>{p.done} of {p.total} required answers filled in</div></div>}
        <Link href="/portal/onboarding" className="mk-btn mk-btn-primary mt-6">{o.status === "draft" ? "Start onboarding" : o.status === "changes_requested" ? "Update onboarding" : "View onboarding"}</Link>
      </div>
      <p className="mt-6 text-[13.5px]" style={{ color: "var(--mk-muted)" }}>Projects, files, billing and support will appear here as your agency turns them on.</p>
    </div>
  );
}
