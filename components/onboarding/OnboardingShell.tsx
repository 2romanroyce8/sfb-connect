"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OnboardingState, StepDef } from "@/lib/onboarding/flow";
import type { BusinessProfile } from "@/lib/onboarding/state";
import StepProfile from "./steps/StepProfile";
import StepConnect from "./steps/StepConnect";
import StepBrand from "./steps/StepBrand";
import StepCapabilities from "./steps/StepCapabilities";
import StepNotYet from "./steps/StepNotYet";

export type Cap = { key: string; name: string; short: string; enabled: boolean };
export type ShellProps = {
  state: OnboardingState; step: StepDef; business: BusinessProfile; stepData: Record<string, unknown> | null;
  integrations: { gmail: string | null; calendar: string | null }; capabilities: Cap[]; flash: { ok: boolean; text: string } | null;
};

/** Progress rail + the current step. Progress saves per step; resume lands on the first unfinished step. */
export default function OnboardingShell(p: ShellProps) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const me = p.state.steps.find((s) => s.no === p.step.no)!;
  const next = p.state.steps.find((s) => s.no > p.step.no && !s.locked) ?? null;
  const goNext = () => router.push(next ? `/dashboard/onboarding/${next.slug}` : "/dashboard");

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  };
  const confirm = async (data?: Record<string, unknown>) => { setErr(null); try { await post({ action: "confirm", step: p.step.no, data }); router.refresh(); goNext(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } };
  const save = async (data: Record<string, unknown>) => { try { await post({ action: "save", step: p.step.no, data }); } catch { /* drafts are best-effort */ } };
  const dismiss = async () => { setErr(null); try { await post({ action: "dismiss" }); router.push("/dashboard"); } catch (e) { setErr(e instanceof Error ? e.message : "Could not continue."); } };

  return (
    <div className="max-w-[1040px]">
      <div className="mb-6 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-neutral-500">Onboarding · step {p.step.no} of 11</div>
          <h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight mt-1">{p.step.title}</h1>
          <div className="text-[14px] text-neutral-500 mt-1">{p.step.short}</div>
        </div>
        <div className="text-[12.5px] text-neutral-500">{p.state.percent}% done{p.state.gatesPassed ? <> · <button onClick={dismiss} className="underline underline-offset-2 text-neutral-700">Go to dashboard, finish later</button></> : null}</div>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-100 mb-8 overflow-hidden"><div className="h-full bg-neutral-900 transition-all" style={{ width: `${p.state.percent}%` }} /></div>

      <div className="grid md:grid-cols-[260px_1fr] gap-8">
        <ol className="flex flex-col gap-1 md:sticky md:top-6 self-start">
          {p.state.steps.map((s) => (
            <li key={s.no}>
              {s.locked ? (
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-neutral-400" title={s.lockReason ?? undefined}><span className="w-5 h-5 rounded-full border border-neutral-200 text-[11px] grid place-items-center">{s.no}</span>{s.title}</div>
              ) : (
                <Link href={`/dashboard/onboarding/${s.slug}`} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] ${s.no === p.step.no ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}>
                  <span className={`w-5 h-5 rounded-full text-[11px] grid place-items-center ${s.done ? "bg-emerald-500 text-white" : s.no === p.step.no ? "bg-white text-neutral-900" : "border border-neutral-300"}`}>{s.done ? "✓" : s.no}</span>
                  <span className="truncate">{s.title}</span>{s.required && !s.done && <span className="ml-auto text-[10px] uppercase tracking-wide text-amber-600">required</span>}
                </Link>
              )}
            </li>
          ))}
        </ol>

        <div className="min-w-0" data-tour={`onb-step-${p.step.no}`}>
          {p.flash && <div className={`rounded-xl px-4 py-3 text-[13px] mb-4 ${p.flash.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{p.flash.text}</div>}
          {me.locked ? (
            <div className="border border-amber-200 bg-amber-50 rounded-2xl p-6 text-[14px] text-amber-900">{me.lockReason} <Link href="/dashboard/onboarding/gmail" className="underline">Go to step 2.</Link></div>
          ) : p.step.no === 1 ? <StepProfile business={p.business} draft={p.stepData} onSave={save} onConfirm={confirm} />
            : p.step.no === 2 ? <StepConnect kind="gmail" account={p.integrations.gmail} done={me.done} onNext={goNext} />
            : p.step.no === 3 ? <StepConnect kind="calendar" account={p.integrations.calendar} done={me.done} onNext={goNext} />
            : p.step.no === 4 ? <StepBrand business={p.business} onConfirm={confirm} />
            : p.step.no === 5 ? <StepCapabilities capabilities={p.capabilities} onConfirm={confirm} />
            : <StepNotYet step={p.step} onNext={goNext} hasNext={!!next} />}
          {err && <div className="mt-4 text-[13px] text-red-600">{err}</div>}
        </div>
      </div>
    </div>
  );
}
