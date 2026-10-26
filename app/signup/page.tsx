import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MkShell from "@/components/mk/MkShell";
import SignupForm from "@/components/mk/SignupForm";
import { getAgencyContext } from "@/lib/agency/context";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start your agency", description: "Create your account and your agency workspace.", alternates: { canonical: "/signup" } };
export default async function Page() {
  const r = await getAgencyContext();
  if (r.status === "ok") redirect("/app");
  if (r.status === "no_agency") redirect("/app/start");
  return (<MkShell><section className="px-6 py-24 flex justify-center"><SignupForm /></section></MkShell>);
}
