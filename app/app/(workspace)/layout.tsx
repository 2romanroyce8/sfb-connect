import { redirect } from "next/navigation";
import AgencySidebar from "@/components/agency/AgencySidebar";
import { getAgencyContext } from "@/lib/agency/context";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const r = await getAgencyContext();
  if (r.status === "anon") redirect("/login?next=/app");
  if (r.status === "no_agency") redirect("/app/start");
  return (
    <div className="min-h-screen flex" style={{ background: "var(--hx-000000)", color: "var(--hx-f5f5f7)" }}>
      <AgencySidebar agencyName={r.ctx.agencyName} userName={r.ctx.userName} role={r.ctx.role} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
