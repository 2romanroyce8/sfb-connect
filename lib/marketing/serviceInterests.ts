// Shared between the client-side ServiceInquiryForm and the
// /api/services/inquiry route handler. Kept out of route.ts on purpose --
// importing a route handler (which pulls in next/headers via
// createSupabaseServerClient) into a "use client" component would drag
// server-only code into the client bundle.
export const SERVICE_INTERESTS = ["AI Presence", "Not Sure"] as const;

export type ServiceInterest = (typeof SERVICE_INTERESTS)[number];
