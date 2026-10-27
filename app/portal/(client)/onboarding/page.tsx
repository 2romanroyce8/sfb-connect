import { getPortalContext } from "@/lib/agency/portalContext";
import OnboardingForm from "@/components/agency/OnboardingForm";

export default async function OnboardingPage() {
  const r = await getPortalContext(); if (r.status !== "ok") return null;
  const o = r.ctx.onboarding;
  return (<div><h1 className="text-[36px] sm:text-[46px]">Onboarding</h1><p className="mt-3 text-[16px]" style={{ color: "var(--mk-muted)" }}>The more you tell us now, the better your build. Save as you go. Do not enter passwords here; we connect your tools through secure sign-in links.</p>
    {o.status === "changes_requested" && o.review_note && <div className="mt-5 rounded-[12px] px-4 py-3 text-[14.5px]" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)" }}><strong>From your agency:</strong> {o.review_note}</div>}
    <OnboardingForm initial={o.answers} status={o.status} /></div>);
}
