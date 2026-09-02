import DashboardNav from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <DashboardNav />
      <main className="flex-1 px-6 md:px-12 py-10 max-w-[1000px]">{children}</main>
    </div>
  );
}
