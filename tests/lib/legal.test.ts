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

test("terms: SFB Agent tier numbers in the price-table default come from the pricing single source", () => {
  const item = LEGAL_DOCS.terms.openItems.find((i) => i.id === "price_table")!;
  assert.match(item.workingDefault!, /Solo \(\$1,497\/mo/);
  assert.match(item.workingDefault!, /Agency \(\$4,997\/mo/);
  assert.match(item.workingDefault!, /128 one-time credits/);
});
