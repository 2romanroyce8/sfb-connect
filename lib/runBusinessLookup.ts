import type { AISummary, LookupResult } from "@/lib/businessLookupContext";

export type LookupOutcome =
  | { status: "needs_link"; message: string }
  | { status: "failed"; message: string }
  | { status: "completed"; result: LookupResult; summary: AISummary | null };

export async function runBusinessLookup(
  query: string,
  location?: string
): Promise<LookupOutcome> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { status: "failed", message: "Lookup is temporarily unavailable." };
  }
  try {
    const res = await fetch(`${url}/functions/v1/business-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ query, location: location || undefined }),
    });
    const data = await res.json();
    if (data.status === "completed")
      return { status: "completed", result: data.result, summary: data.summary ?? null };
    if (data.status === "needs_link")
      return { status: "needs_link", message: data.message };
    return { status: "failed", message: data.message || "Something went wrong." };
  } catch {
    return {
      status: "failed",
      message: "We couldn't reach the lookup service. Try again in a moment.",
    };
  }
}
