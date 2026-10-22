import { createSupabaseServerClient } from "@/lib/supabase/server";
import ChatHome from "@/components/assistant/ChatHome";

// Team home = the assistant (Roman, 2026-10-22). The numbers dashboard stays one click away at /team/dashboard.
export default async function TeamChatPage() {
  const db = createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  const { data: p } = user ? await db.from("users").select("full_name, email").eq("id", user.id).maybeSingle() : { data: null };
  const first = ((p?.full_name as string | null) || (p?.email as string | null) || "").split(/[ @]/)[0];
  return <ChatHome endpoint="/api/team/assistant" register="dark" audience="team" name={first} />;
}
