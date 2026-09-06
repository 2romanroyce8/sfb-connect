import type { Candidate, FetchedPage } from "./types";
import { extractJsonLd, findLocalBusiness, extractMailtoEmails, extractVisibleEmails, extractPhoneNumbers, extractWhatsAppLinks } from "./htmlExtract";
import { normalizePhone, isPlausibleEmail } from "./normalize";

export type ContactCandidates = {
  phone: Candidate[];
  email: Candidate[];
  whatsapp: Candidate[];
  booking: Candidate[];
};

// Never guesses an address — every candidate here traces to a phone number,
// mailto link, or wa.me URL that was actually present in a fetched page.
export function discoverContacts(pages: FetchedPage[], bookingLinksFromNav: string[]): ContactCandidates {
  const phone: Candidate[] = [];
  const email: Candidate[] = [];
  const whatsapp: Candidate[] = [];
  const booking: Candidate[] = bookingLinksFromNav.map((url) => ({ value: url, sourceUrl: url, sourceType: "website", strength: 2 }));

  for (const page of pages) {
    if (!page.ok) continue;
    const jsonLd = extractJsonLd(page.html);
    const localBusiness = findLocalBusiness(jsonLd);

    const schemaPhone = localBusiness?.telephone ? String(localBusiness.telephone) : null;
    if (schemaPhone) {
      const n = normalizePhone(schemaPhone);
      if (n) phone.push({ value: n, sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 3 });
    }
    for (const raw of extractPhoneNumbers(page.html)) {
      const n = normalizePhone(raw);
      if (n) phone.push({ value: n, sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: page.sourceType === "website" ? 2 : 1 });
    }

    const schemaEmail = localBusiness?.email ? String(localBusiness.email) : null;
    if (schemaEmail && isPlausibleEmail(schemaEmail)) {
      email.push({ value: schemaEmail.toLowerCase(), sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 3 });
    }
    for (const e of extractMailtoEmails(page.html)) {
      if (isPlausibleEmail(e)) email.push({ value: e, sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 3 });
    }
    for (const e of extractVisibleEmails(page.html)) {
      if (isPlausibleEmail(e)) email.push({ value: e, sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 2 });
    }

    for (const w of extractWhatsAppLinks(page.html)) {
      whatsapp.push({ value: w, sourceUrl: page.finalUrl, sourceType: page.sourceType, strength: 3 });
    }
  }

  return { phone, email, whatsapp, booking };
}
