import { redirect } from "next/navigation";
import { getAgencyContext } from "@/lib/agency/context";
import StartAgencyForm from "@/components/agency/StartAgencyForm";

export default async function StartAgencyPage() {
  const r = await getAgencyContext();
  if (r.status === "anon") redirect("/login?next=/app/start");
  if (r.status === "ok") redirect("/app");
  return <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--hx-000000)", color: "var(--hx-f5f5f7)" }}><StartAgencyForm /></div>;
}
