# Runbook — Legal pages (/privacy, /terms)

**Owner:** Roman (content decisions) · engineering wires only. **Drafts by:** Atlas (Muse), 2026-10-09.

## Where the text lives
- `lib/legal/documents.ts` — the ONLY copy of the Privacy Policy and Terms. Each `[TO CONFIRM]` / `[DECISION]` from Muse's draft is an `openItems` entry with `resolution: null`, and the body text references it as `{{item_id}}`.
- `components/legal/LegalDocument.tsx` — renderer (`mode: "public" | "preview"`).
- `app/privacy/page.tsx`, `app/terms/page.tsx` — public routes. Render the full text **only** when `isPublishable(doc)` (every open item resolved). Otherwise: the "being finalized" placeholder, `robots: noindex`.
- `app/team/(app)/legal/page.tsx` — team preview (sidebar → System → Legal Drafts, owner-only). Shows the full draft, open items highlighted yellow, resolved green, with the checklist of what Roman must decide and any engineering notes (e.g. conflicts with the pricing single source).

## How to publish (the only steps)
1. Attorney review of the draft (Muse's own condition).
2. In `lib/legal/documents.ts`, set `resolution` on **every** open item of the document (whitespace does not count). Working defaults are listed on each item; copy them into `resolution` if accepted.
3. Commit + deploy (push to `main`, Vercel auto-deploys). No flags, no env vars.
4. Verify: `/team/legal?doc=terms` shows "Ready to publish"; `/terms` shows the full text and no `noindex` in `<head>`.

Partial publishing is impossible by construction: `renderPublicText` throws on an unresolved document and `tests/lib/legal.test.ts` fails if a token has no declared item or an item is never referenced.

## Changing the text later
Edit `documents.ts`, bump `lastUpdated` (and `effectiveDate` when the Terms change materially — §13 promises a notice period before material changes take effect). The pricing sentence in Terms §2 quotes numbers: when prices change, update the `price_table` resolution the same day.

## Known decisions pending (as of 2026-10-09, after Atlas's final copy pack)
Atlas settled: retention (delete on request, billing records 7 yrs), refunds (non-refundable, cancel anytime), export window 30 days, notice period 14 days, venue (arbitration in Florida), credit expiry ("while membership remains active"), price table (now generated from config).
Still open — Roman's [FILL]s: Privacy: entity, support email, privacy email, address, contact email. Terms: entity, governing law, address, contact email.
Engineering flags for Atlas/Roman: (1) Terms §2 states the Solo/Agency one-time onboarding fees because config + checkout charge them — Atlas's draft omitted them; (2) pricing FAQ "no setup fees" removed for the same reason.
