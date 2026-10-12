import type { SupabaseClient } from "@supabase/supabase-js";
import { alertOwners, esc } from "./ownerAlerts";

export type LeadAlertInput = {
  source: "website_lead" | "service_inquiry" | "funnel_verified";
  businessName?: string | null; name?: string | null; email?: string | null; phone?: string | null; website?: string | null;
  category?: string | null; serviceInterest?: string | null;
};

const LABEL: Record<LeadAlertInput["source"], string> = { website_lead: "New lead", service_inquiry: "New inquiry", funnel_verified: "New verified signup" };

/** One alert per real lead: website forms, service inquiries, funnel signups that verified their email. */
export async function newLeadAlert(service: SupabaseClient, lead: LeadAlertInput) {
  const who = [lead.businessName, lead.name].filter(Boolean).join(" / ") || lead.email || "someone";
  const bits = [lead.phone, lead.email, lead.website, lead.serviceInterest ?? lead.category].filter(Boolean) as string[];
  const label = LABEL[lead.source];
  return alertOwners(service, {
    trigger: "lead_new",
    sms: `${label}: ${who}${bits.length ? ` - ${bits.join(", ")}` : ""}`,
    email: { subject: `${label}: ${who}`, html: `<p><strong>${esc(label)}</strong> — ${esc(who)}</p><p>${bits.map(esc).join("<br/>")}</p><p><a href="https://www.sfbconnect.com/team/leads">Open leads</a></p>`, text: `${label}: ${who}\n${bits.join("\n")}\nhttps://www.sfbconnect.com/team/leads` },
    inApp: { type: "lead_new", title: `${label}: ${who}`, body: bits.join(" · ") || undefined, actionUrl: "/team/leads", actionLabel: "Open leads" },
    detail: { source: lead.source },
  });
}
