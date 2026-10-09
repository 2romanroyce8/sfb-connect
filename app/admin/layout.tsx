import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/admin" className="font-extrabold text-base">
            SFB <span className="text-medium-gray font-semibold">CONNECT ADMIN</span>
          </Link>
          <Link href="/admin" className="text-sm text-medium-gray hover:text-white transition-colors">
            Customers
          </Link>
          <Link href="/admin/payments" className="text-sm text-medium-gray hover:text-white transition-colors">
            Payments
          </Link>
        </div>
        <Link href="/dashboard" className="text-sm text-medium-gray hover:text-white transition-colors">
          Exit Admin
        </Link>
      </div>
      <div className="px-8 py-10 max-w-[1200px] mx-auto">{children}</div>
    </div>
  );
}
