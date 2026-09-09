export type RankingCandidate = {
  rank: number;
  name: string;
  domain: string;
  url: string;
  reason: string;
  isYourBusiness: boolean;
};

export type YourBusinessStanding = {
  inTopFive: boolean;
  rank: number | null;
  status: "top5" | "outside" | "unverified";
  note: string;
};

export type RankingOutcome =
  | {
      status: "completed";
      niche: string;
      geography: string;
      confidence: "HIGH" | "MEDIUM" | "LOW";
      analyzedAt: string;
      topFive: RankingCandidate[];
      yourBusiness: YourBusinessStanding;
    }
  | { status: "insufficient_evidence"; message: string; niche?: string; geography?: string }
  | { status: "unavailable"; message: string; niche?: string; geography?: string }
  | { status: "failed"; message: string };

/**
 * Builds a real, evidence-based "AI Discovery Market Position" for the
 * niche + location the earlier business-lookup already verified. This
 * never guesses -- if the category/location aren't specific enough, or
 * too few real businesses can be identified, it comes back honest instead
 * of inventing a ranking.
 */
export async function runNicheRanking(params: {
  category: string | null;
  location: string | null;
  businessName: string | null;
  businessWebsite: string | null;
}): Promise<RankingOutcome> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { status: "failed", message: "Market comparison is temporarily unavailable." };
  }
  try {
    const res = await fetch(`${url}/functions/v1/niche-ranking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data as RankingOutcome;
  } catch {
    return { status: "failed", message: "We couldn't reach the market comparison service." };
  }
}
