import "@/components/mk/mk.css";
import JoinForm from "@/components/agency/JoinForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Join your client portal", robots: { index: false, follow: false } };
export default function JoinPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === "string" ? searchParams.token.slice(0, 200) : "";
  return <div className="mk"><main className="px-5 py-24 flex justify-center"><JoinForm token={token} /></main></div>;
}
