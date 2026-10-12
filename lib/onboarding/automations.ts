// Step 8 — automations: the default follow-up sequence, pre-filled with the
// real templates rendered against this business's own facts. Activating
// creates the outbound_sequences row the engine and the hourly cron already
// use. Every step still needs human approval before it sends.
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES, DEFAULT_SEQUENCE_STEPS, renderTemplate, type TemplateKey } from "@/lib/outbound/templates";

export type CadenceKey = "steady" | "quick" | "patient";
export const CADENCES: { key: CadenceKey; label: string; hint: string; steps: { day: number; template: TemplateKey }[] }[] = [
  { key: "steady", label: "Steady (default)", hint: "Intro today, follow-up day 3, last note day 7.", steps: DEFAULT_SEQUENCE_STEPS },
  { key: "quick", label: "Quick", hint: "Intro today, follow-up day 2, last note day 4.", steps: [{ day: 0, template: "intro" }, { day: 2, template: "follow_up_1" }, { day: 4, template: "follow_up_2" }] },
  { key: "patient", label: "Patient", hint: "Intro today, follow-up day 5, last note day 12.", steps: [{ day: 0, template: "intro" }, { day: 5, template: "follow_up_1" }, { day: 12, template: "follow_up_2" }] },
];
export const cadence = (k: string | null | undefined) => CADENCES.find((c) => c.key === k) ?? CADENCES[0];
export const SEQUENCE_NAME = "Default 3-step";

export type SequencePreview = { day: number; template: TemplateKey; subject: string; body: string }[];

/** Renders each step with the business's facts and a sample prospect. Throws (with the missing facts) when the profile is incomplete — never fills a guess. */
export function previewSequence(steps: { day: number; template: TemplateKey }[], sender: { name: string; company: string; category: string | null; offerLine: string | null }, sample: { company: string; city: string | null; category: string | null }): SequencePreview {
  return steps.map((s) => ({ ...s, ...renderTemplate(s.template, { company: sample.company, contact_name: null, city: sample.city, category: sample.category, sender_name: sender.name, sender_company: sender.company, sender_category: sender.category, offer_line: sender.offerLine }) }));
}
export const templateMeta = (k: TemplateKey) => TEMPLATES[k];

/** Create or update the business's default sequence and set it active. Idempotent on name. */
export async function activateSequence(service: SupabaseClient, businessId: string, key: CadenceKey) {
  const c = cadence(key);
  const { data: existing } = await service.from("outbound_sequences").select("id").eq("business_id", businessId).eq("name", SEQUENCE_NAME).maybeSingle();
  if (existing) { const { error } = await service.from("outbound_sequences").update({ steps: c.steps, status: "active" }).eq("id", existing.id); if (error) throw new Error(error.message); return existing.id as string; }
  const { data, error } = await service.from("outbound_sequences").insert({ business_id: businessId, name: SEQUENCE_NAME, steps: c.steps, status: "active" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
