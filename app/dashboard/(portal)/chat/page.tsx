import { getCustomerContext } from "@/lib/customerPortal/context";
import { redirect } from "next/navigation";
import ChatHome from "@/components/assistant/ChatHome";

// Client home = the assistant (Roman, 2026-10-22). Overview (the numbers page) stays at /dashboard?view=overview.
export default async function PortalChatPage() {
  const result = await getCustomerContext("/dashboard/chat");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  return <ChatHome endpoint="/api/dashboard/assistant" register="light" audience="client" name={result.context.firstName ?? ""} />;
}
