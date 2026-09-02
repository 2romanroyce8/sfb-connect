import Link from "next/link";
import { listProjectsForAdmin } from "@/lib/adminData";
import { PROJECT_STATUS_LABELS } from "@/lib/types";

export default async function AdminCustomerListPage() {
  const projects = await listProjectsForAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Customers</h1>
      <p className="text-medium-gray mb-8">
        {projects.length} project{projects.length === 1 ? "" : "s"}
      </p>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-medium-gray text-[12px] font-mono uppercase border-b border-white/10">
              <th className="px-5 py-3">Business</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Started</th>
              <th className="px-5 py-3">Target</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p: any) => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="px-5 py-4 font-medium">{p.businesses?.legal_name}</td>
                <td className="px-5 py-4 text-medium-gray">{p.businesses?.primary_category || "—"}</td>
                <td className="px-5 py-4">
                  <span className="bg-white/10 px-2.5 py-1 rounded-full text-[12px] font-mono">
                    {PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS]}
                  </span>
                </td>
                <td className="px-5 py-4 text-medium-gray font-mono text-[13px]">
                  {new Date(p.started_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-4 text-medium-gray font-mono text-[13px]">
                  {p.target_completion_at ? new Date(p.target_completion_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/admin/${p.id}`} className="text-sm underline">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-medium-gray">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
