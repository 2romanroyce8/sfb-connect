// Template library, server side: system presets + the business's saved
// presets, each previewed with the business's own info; the business's intro
// choice; saving a sent email (variable form) as a preset.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY, PRESET_CATEGORIES, presetByKey, recommendIntro, type Preset } from "./presets";
import { renderSource, validateSource, TEMPLATE_VARIABLES, type TemplateVars, type TemplateSource } from "./templates";
import { OutboundError } from "./errors";

export type LibraryItem = { key: string; name: string; category: string; categoryLabel: string; tone: string; audience: string; description: string; subject: string; body: string; preview: { subject: string; body: string } | { error: string }; saved: boolean; approved: boolean };
export type SavedTemplate = { id: string; business_id: string; name: string; category: string; subject: string; body: string; created_by: string; created_at: string };

export async function senderVarsFor(service: SupabaseClient, businessId: string): Promise<Pick<TemplateVars, "sender_name" | "sender_company" | "sender_category" | "offer_line"> & { businessId: string; introTemplate: string | null; icp: { industries?: string[]; notes?: string | null } | null }> {
  const { data: b } = await service.from("businesses").select("id, legal_name, owner_id, primary_category, outbound_offer_line, outbound_intro_template, icp").eq("id", businessId).single();
  if (!b) throw new OutboundError("business_not_found", "Business not found.", 404);
  const { data: owner } = await service.from("users").select("full_name, email").eq("id", b.owner_id).maybeSingle();
  return { businessId, sender_name: (owner?.full_name as string) || (owner?.email as string) || b.legal_name, sender_company: b.legal_name, sender_category: b.primary_category, offer_line: b.outbound_offer_line, introTemplate: (b.outbound_intro_template as string | null) ?? null, icp: (b.icp as { industries?: string[]; notes?: string | null } | null) ?? null };
}

/** A sample prospect for previews: the first uncontacted one, else a labelled placeholder (shown as such). */
export async function sampleProspect(service: SupabaseClient, businessId: string): Promise<{ company: string; contact_name: string | null; city: string | null; category: string | null; placeholder: boolean }> {
  const { data: p } = await service.from("outbound_prospects").select("name, contact_name, city, category").eq("business_id", businessId).in("status", ["sourced", "enriched"]).order("created_at").limit(1).maybeSingle();
  if (p) return { company: p.name as string, contact_name: (p.contact_name as string | null) ?? null, city: (p.city as string | null) ?? null, category: (p.category as string | null) ?? null, placeholder: false };
  return { company: "Acme Property Management", contact_name: "Jane Rivera", city: "Tampa", category: "property management company", placeholder: true };
}

/** Resolve "saved:<uuid>" / preset key / "custom" to a renderable source for this business. */
export async function resolveSource(service: SupabaseClient, businessId: string, key: string, custom?: { subject: string; body: string } | null): Promise<TemplateSource & { label: string }> {
  if (key === "custom") {
    if (!custom?.subject?.trim() || !custom?.body?.trim()) throw new OutboundError("custom_empty", "Write a subject and a body first.");
    const bad = validateSource(custom); if (bad.length) throw new OutboundError("custom_placeholder", `Unknown placeholder ${bad.map((b) => `{{${b}}}`).join(", ")}. You can use: ${TEMPLATE_VARIABLES.map((v) => v.token).join(" ")}`);
    return { subject: custom.subject.slice(0, 300), body: custom.body.slice(0, 6000), requires: ["sender_name", "sender_company"], label: "custom" };
  }
  if (key.startsWith("saved:")) {
    const { data: t } = await service.from("outbound_templates").select("id, name, subject, body").eq("id", key.slice(6)).eq("business_id", businessId).eq("archived", false).maybeSingle();
    if (!t) throw new OutboundError("template_not_found", "That saved template isn't on this account.", 404);
    return { subject: t.subject as string, body: t.body as string, requires: ["sender_name", "sender_company"], label: `saved:${t.id}` };
  }
  const p = presetByKey(key); if (!p) throw new OutboundError("template_not_found", `Unknown template "${key}".`, 404);
  return { subject: p.subject, body: p.body, requires: p.requires, label: p.key };
}

export async function listLibrary(service: SupabaseClient, businessId: string) {
  const [sender, sample, { data: saved }, { data: prospects }] = await Promise.all([
    senderVarsFor(service, businessId), sampleProspect(service, businessId),
    service.from("outbound_templates").select("id, business_id, name, category, subject, body, created_by, created_at").eq("business_id", businessId).eq("archived", false).order("created_at", { ascending: false }),
    service.from("outbound_prospects").select("name, contact_name, website, source").eq("business_id", businessId).in("status", ["sourced", "enriched"]).limit(200),
  ]);
  const vars: TemplateVars = { company: sample.company, contact_name: sample.contact_name, city: sample.city, category: sample.category, sender_name: sender.sender_name, sender_company: sender.sender_company, sender_category: sender.sender_category, offer_line: sender.offer_line, slots: null };
  const preview = (src: TemplateSource) => { try { return renderSource(src, vars); } catch (e) { return { error: e instanceof Error ? e.message : "Can't preview yet." }; } };
  const cat = (k: string) => PRESET_CATEGORIES.find((c) => c.key === k)?.label ?? k;
  const items: LibraryItem[] = [
    ...LIBRARY.map((p: Preset) => ({ key: p.key, name: p.name, category: p.category, categoryLabel: cat(p.category), tone: p.tone, audience: p.audience, description: p.description, subject: p.subject, body: p.body, preview: preview({ subject: p.subject, body: p.body, requires: p.requires, label: p.key }), saved: false, approved: !!p.approvedAt })),
    ...((saved ?? []) as SavedTemplate[]).map((t) => ({ key: `saved:${t.id}`, name: t.name, category: t.category, categoryLabel: t.category === "custom" ? "Your custom emails" : "Saved from sent", tone: "yours", audience: "any", description: `Saved ${new Date(t.created_at).toLocaleDateString()} by ${t.created_by}`, subject: t.subject, body: t.body, preview: preview({ subject: t.subject, body: t.body, requires: ["sender_name", "sender_company"], label: t.name }), saved: true, approved: true })),
  ];
  const recommendation = recommendIntro((prospects ?? []) as { source?: string | null; website?: string | null; contact_name?: string | null; name: string }[], sender.icp);
  return { items, categories: PRESET_CATEGORIES, variables: TEMPLATE_VARIABLES, sample, introTemplate: sender.introTemplate, recommendation, offerLineMissing: !sender.offer_line };
}

export async function pickIntro(service: SupabaseClient, businessId: string, key: string | null) {
  if (key !== null) await resolveSource(service, businessId, key); // validates it exists for this business
  const { error } = await service.from("businesses").update({ outbound_intro_template: key, updated_at: new Date().toISOString() }).eq("id", businessId);
  if (error) throw new Error(error.message);
  return key;
}

/** Save a preset: from a sent/drafted message (its variable-form template_source) or from the editor. */
export async function saveTemplate(service: SupabaseClient, businessId: string, input: { name: string; messageId?: string | null; subject?: string; body?: string; category?: "saved" | "custom" }, actor: { label: string }) {
  let subject = input.subject ?? "", body = input.body ?? "", category: "saved" | "custom" = input.category ?? "custom", sourceMessageId: string | null = null;
  if (input.messageId) {
    const { data: m } = await service.from("outbound_messages").select("id, subject, body_text, template_source").eq("id", input.messageId).eq("business_id", businessId).maybeSingle();
    if (!m) throw new OutboundError("not_found", "Message not found.", 404);
    const src = m.template_source as { subject?: string; body?: string } | null;
    subject = src?.subject ?? (m.subject as string); body = src?.body ?? (m.body_text as string); category = "saved"; sourceMessageId = m.id as string;
  }
  const name = (input.name || "").trim().slice(0, 80); if (!name) throw new OutboundError("name_required", "Give the preset a name.");
  if (!subject.trim() || !body.trim()) throw new OutboundError("custom_empty", "A preset needs a subject and a body.");
  const bad = validateSource({ subject, body }); if (bad.length) throw new OutboundError("custom_placeholder", `Unknown placeholder ${bad.map((b) => `{{${b}}}`).join(", ")}.`);
  const { data, error } = await service.from("outbound_templates").insert({ business_id: businessId, name, category, subject: subject.slice(0, 300), body: body.slice(0, 6000), source_message_id: sourceMessageId, created_by: actor.label }).select("id, name, category, subject, body, created_at").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function archiveTemplate(service: SupabaseClient, businessId: string, id: string) {
  await service.from("outbound_templates").update({ archived: true }).eq("id", id).eq("business_id", businessId);
}
