import { test } from "node:test";
import assert from "node:assert/strict";
import { LEGAL_DOCS, isPublishable, referencedTokens, renderPublicText, splitText, unresolvedItems } from "../../lib/legal/documents";

for (const doc of Object.values(LEGAL_DOCS)) {
  test(`${doc.slug}: every {{token}} in the text is a declared open item and every item is referenced`, () => {
    const declared = doc.openItems.map((i) => i.id).sort();
    assert.deepEqual(referencedTokens(doc), declared);
    assert.equal(new Set(declared).size, declared.length, "open item ids are unique");
  });

  test(`${doc.slug}: an unresolved document never renders public text`, () => {
    const copy = { ...doc, openItems: doc.openItems.map((i) => ({ ...i, resolution: null })) };
    assert.equal(isPublishable(copy), false);
    assert.throws(() => renderPublicText("x {{" + copy.openItems[0].id + "}}", copy), /unresolved/);
    assert.equal(unresolvedItems(copy).length, copy.openItems.length);
    const blank = { ...copy, openItems: copy.openItems.map((i) => ({ ...i, resolution: "   " })) };
    assert.equal(isPublishable(blank), false, "whitespace is not a resolution");
  });

  test(`${doc.slug}: once every item is resolved, public text substitutes the resolutions and no bracketed placeholders remain`, () => {
    const resolved = { ...doc, openItems: doc.openItems.map((i) => ({ ...i, resolution: `R(${i.id})` })) };
    assert.equal(isPublishable(resolved), true);
    const texts = [...resolved.intro, ...resolved.sections.flatMap((s) => s.blocks)].flatMap((b) => (b.kind === "ul" ? b.items : [b.text]));
    for (const t of texts) {
      const out = renderPublicText(t, resolved);
      assert.doesNotMatch(out, /\{\{|TO CONFIRM|DECISION\]/);
    }
    assert.equal(renderPublicText("Email: {{contact_email}}", resolved), "Email: R(contact_email)");
  });

  test(`${doc.slug}: preview split keeps open items addressable`, () => {
    const parts = splitText("a {{entity}} b", doc);
    assert.deepEqual(parts.map((p) => p.kind), ["text", "item", "text"]);
  });
}

test("terms: plan and pack numbers are generated from the pricing single source (incl. onboarding fees); no Presence plans are listed", () => {
  const items = LEGAL_DOCS.terms.sections.find((s) => s.heading.startsWith("2."))!.blocks.flatMap((b) => (b.kind === "ul" ? b.items : []));
  assert.ok(items.some((t) => t.startsWith("Solo: $1,497/month plus a one-time $1,497 onboarding fee. 150 credits")));
  assert.ok(items.some((t) => t.startsWith("Agency: $4,997/month plus a one-time $4,997 onboarding fee. 500 credits")));
  assert.ok(items.some((t) => t.includes("128 one-time credits")));
  assert.ok(items.some((t) => t.includes("100 credits $149 · 500 credits $599 · 1,000 credits $999")));
  assert.ok(items.every((t) => !/Presence \$|Dominance|Growth \$/.test(t)));
});
