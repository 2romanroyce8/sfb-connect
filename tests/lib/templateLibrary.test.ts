import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, LIBRARY, presetByKey, resolveStepTemplate, recommendIntro } from "../../lib/outbound/presets";
import { renderSource, renderTemplate, validateSource, TEMPLATES, firstName } from "../../lib/outbound/templates";
import { checkAssistResult } from "../../lib/outbound/assist";

const sender = { sender_name: "Roman Royce", sender_company: "SFB Connect", sender_category: "marketing agency", offer_line: "We put one AI agent on a local business." };
const biz = { company: "Acme Property Mgmt", contact_name: "Jane Rivera", city: "Tampa", category: "property management company", ...sender };
const person = { company: "Pat O'Brien", contact_name: "Pat O'Brien", city: "Tampa", category: null, ...sender };

test("every library preset renders for both a business and a consumer sample, with no unresolved braces", () => {
  for (const p of LIBRARY) {
    for (const v of [biz, person]) {
      const vars = { ...v, slots: "Tue 10:00, Wed 2:00 (ET)", review_link: null };
      const r = renderTemplate(p.key, vars);
      assert.ok(!/\{\{|\}\}/.test(r.subject + r.body), `${p.key} left a placeholder: ${r.subject} ${r.body}`);
      assert.ok(r.body.length > 40 && r.subject.length > 3, `${p.key} rendered too short`);
    }
  }
});

test("consumer presets never say the prospect's 'company' or 'kind of business'; business presets keep the originals verbatim", () => {
  for (const p of PRESETS.filter((x) => x.audience === "consumer")) assert.ok(!p.body.includes("{{company}}") && !p.subject.includes("{{company}}") && !/kind of \{\{category_or_business\}\}/.test(p.body), `${p.key} uses company wording`);
  assert.equal(TEMPLATES.intro.body.split("\n")[2], "I run {{sender_company}}{{sender_category_phrase}}{{city_phrase}}. I'm reaching out because {{company}} is the kind of {{category_or_business}} we work alongside well.");
  assert.equal(presetByKey("intro")!.approvedAt, "2026-10-11"); assert.ok(presetByKey("intro_b2c")!.approvedAt, "new copy ships only after Roman reads it — approved 2026-10-12");
  for (const p of LIBRARY) assert.ok(p.approvedAt, `${p.key} has no approval date`);
});

test("greetings: consumer greeting uses the first name; team greeting for a company; 'there' fallback; Last, First handled", () => {
  const r = renderTemplate("intro_b2c", { ...person, contact_name: "O'Brien, Pat" }); assert.ok(r.body.startsWith("Hi Pat,"), r.body.slice(0, 20));
  const r2 = renderTemplate("intro", { ...biz, contact_name: null }); assert.ok(r2.body.startsWith("Hi Acme Property Mgmt team,"));
  const r3 = renderSource({ subject: "s", body: "Hi {{first name}}, from {{your company}}", requires: [] }, { ...biz, contact_name: null, company: "Acme" }); assert.equal(r3.body, "Hi there, from SFB Connect", "aliases + fallback");
  assert.equal(firstName("Royce, Roman"), "Roman");
});

test("custom emails: unknown placeholders are refused with the list; known aliases pass", () => {
  assert.deepEqual(validateSource({ subject: "Hi {{first_name}}", body: "{{company}} {{offer_line}} {{sender_name}}" }), []);
  assert.deepEqual(validateSource({ subject: "Hi {{frist_name}}", body: "{{discount_code}} ok {{company}}" }), ["frist_name", "discount_code"]);
  assert.throws(() => renderSource({ subject: "x", body: "{{discount_code}}", requires: [] }, biz), /unknown placeholder/);
});

test("sequence steps follow the chosen intro: consumer intro → consumer follow-ups; business intro → originals", () => {
  assert.equal(resolveStepTemplate("intro", "intro_b2c_warm"), "intro_b2c_warm");
  assert.equal(resolveStepTemplate("follow_up_1", "intro_b2c"), "follow_up_b2c_1"); assert.equal(resolveStepTemplate("follow_up_2", "intro_b2c_direct"), "follow_up_b2c_2");
  assert.equal(resolveStepTemplate("follow_up_1", "intro"), "follow_up_1"); assert.equal(resolveStepTemplate("follow_up_1", "saved:abc"), "follow_up_1", "a saved intro keeps business follow-ups");
});

test("recommendation: mostly-people upload → consumer; consumer ICP words → consumer; otherwise business; never random", () => {
  const people = [{ name: "Pat", contact_name: "Pat", website: null, source: "upload" }, { name: "Lee", contact_name: "Lee", website: null, source: "upload" }, { name: "Acme", contact_name: "Jane", website: "https://acme.com", source: "agent" }];
  assert.equal(recommendIntro(people, null).key, "intro_b2c");
  assert.equal(recommendIntro([], { industries: ["homeowners in Tampa"] }).key, "intro_b2c");
  assert.equal(recommendIntro([{ name: "Acme", contact_name: null, website: "https://acme.com", source: "agent" }], { industries: ["property management company"] }).key, "intro");
  assert.equal(recommendIntro([], null).key, "intro");
});

test("assist guard: an edit must keep the same placeholder set and introduce no unknown ones", () => {
  const o = { subject: "Hi {{first_name}}", body: "{{offer_line}}\n{{sender_name}}" };
  assert.equal(checkAssistResult(o, { subject: "Hello {{first_name}}", body: "Short: {{offer_line}}\n— {{sender_name}}" }), null);
  assert.match(checkAssistResult(o, { subject: "Hello", body: "{{offer_line}} {{sender_name}}" }) ?? "", /dropped \{\{first_name\}\}/);
  assert.match(checkAssistResult(o, { subject: "Hi {{first_name}}", body: "{{offer_line}} {{sender_name}} {{discount}}" }) ?? "", /added/);
  assert.match(checkAssistResult(o, { subject: "", body: "" }) ?? "", /dropped|empty/);
});
