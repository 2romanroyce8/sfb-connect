import type { CategoryResult } from "./audit";
import { OFFER_LABEL, type Offer } from "./opportunity";

export type ScriptVariant = "original" | "shorter" | "direct" | "conversational";

export type ScriptSections = {
  opening: string;
  hook: string;
  observation: string;
  problem: string;
  why_it_matters: string;
  solution: string;
  discovery_question: string;
  transition: string;
  booking_ask: string;
  objections: { objection: string; response: string }[];
  close: string;
};

function byCategory(categories: CategoryResult[]) {
  const map: Record<string, CategoryResult> = {};
  for (const c of categories) map[c.category] = c;
  return map;
}

// Turns a category's negative/unknown evidence into a hedged, non-fabricated
// observation. Confirmed absence ("not_found" — we checked and it wasn't
// there) is stated plainly; anything we didn't fully verify is hedged.
function pickObservation(categories: CategoryResult[]): { text: string; category: CategoryResult } {
  const priority = ["machine_readability", "knowledge", "identity", "authority", "location"];
  for (const key of priority) {
    const cat = categories.find((c) => c.category === key);
    if (cat && (cat.negative_evidence.length > 0 || cat.unknowns.length > 0)) {
      const text = cat.negative_evidence[0] || cat.unknowns[0];
      return { text, category: cat };
    }
  }
  const strongest = [...categories].sort((a, b) => b.score - a.score)[0];
  return { text: strongest.positive_evidence[0] || "your online presence", category: strongest };
}

function softHedge(text: string): string {
  // "No meta description found" -> "some of the information AI systems look
  // for, like a meta description, wasn't showing up"
  return text
    .replace(/^No /, "some of the information AI systems look for, like ")
    .replace(/ found on the website$/, ", wasn't showing up on the site")
    .replace(/^Could not confirm /, "we weren't able to confirm ");
}

export function generateScript(
  businessName: string | null,
  category: string | null,
  categories: CategoryResult[],
  opportunity: { primary: Offer; why: string[] },
  variant: ScriptVariant = "original"
): ScriptSections {
  const name = businessName || "your business";
  const kind = category ? category.toLowerCase() : "business";
  const observation = pickObservation(categories);
  const offerLabel = OFFER_LABEL[opportunity.primary];

  const brief = variant === "shorter" || variant === "direct";
  const casual = variant === "conversational";

  const opening = brief
    ? `Hey, is this ${name}?`
    : casual
    ? `Hey there, this is [Rep Name] with SFB Connect — hope I'm catching you at an okay time.`
    : `Hi, this is [Rep Name] calling from SFB Connect. Is this ${name}?`;

  const hook = brief
    ? `Got 30 seconds? I'll be quick.`
    : `I'll only take a couple minutes — I was looking at how ${kind} businesses show up when people ask AI tools like ChatGPT or Google's AI overview for recommendations, and ${name} came up in that research.`;

  const obsText = softHedge(observation.text);
  const businessObservation = `While looking at ${name}'s online presence, I noticed ${obsText}.`;

  const whyItMatters = brief
    ? `That's part of what AI tools use to decide who to recommend — so it can mean fewer people finding you through AI search.`
    : `More and more people are asking AI assistants who to call for a ${kind} instead of searching Google directly, and those systems lean heavily on exactly the kind of information we just talked about. When it's missing or inconsistent, businesses can get skipped over even when they're the better choice.`;

  const discoveryQuestion = `Have you noticed any change in how customers are finding you lately — more from AI tools or voice assistants, less from traditional search?`;

  const solution = `That's actually exactly what we do — we call it ${offerLabel}. ${opportunity.why[0] ? opportunity.why[0] + ". " : ""}We go through and fix the specific gaps like the one I mentioned, so AI systems have a clear, accurate picture of ${name}.`;

  const transition = `I don't want to walk you through all of it over the phone — it's easier to just show you what we found and what we'd fix.`;

  const bookingAsk = brief
    ? `Can I grab 15 minutes on your calendar this week to show you?`
    : `Would it make sense to grab 15-20 minutes this week where I can screen-share and walk you through exactly what we found for ${name}, and what fixing it would look like?`;

  const close = `Great — I'll get that on the calendar and send you a confirmation with the link. Talk soon.`;

  const objections: { objection: string; response: string }[] = [
    {
      objection: "I'm not interested.",
      response: `Totally understand — most people aren't looking for this until they see it costing them customers. Mind if I just send over what we found for ${name}? No obligation, just so you have it.`,
    },
    {
      objection: "We already have someone doing our marketing/SEO.",
      response: `That's great to hear — this is actually a different layer than traditional SEO. It's specifically about how AI assistants read and recommend businesses, which most SEO work doesn't touch yet. Worth a quick look alongside what you're already doing.`,
    },
    {
      objection: "How much does this cost?",
      response: `It depends on what we find needs fixing, but most engagements are a flat annual rate — no monthly subscription. I'd rather show you the specific findings for ${name} first so the number actually means something.`,
    },
    {
      objection: "Send me some information instead.",
      response: `Happy to — I'll send over a summary of what we found. Most people find it's easier to make sense of on a quick call though, since I can point at exactly what we're talking about. Can I still grab 15 minutes?`,
    },
  ];

  return { opening, hook, observation: businessObservation, problem: obsText, why_it_matters: whyItMatters, solution, discovery_question: discoveryQuestion, transition, booking_ask: bookingAsk, objections, close };
}

export function generateObjectionResponse(
  objectionText: string,
  businessName: string | null,
  categories: CategoryResult[]
): string {
  const name = businessName || "this business";
  const observation = pickObservation(categories);
  const hedged = softHedge(observation.text);
  return `Fair point. Just so it's not abstract — for ${name} specifically, ${hedged}. That's the kind of thing that quietly costs AI-driven referrals, and it's exactly what we'd fix first. Worth 15 minutes to see the rest of what we found?`;
}
