import Link from "next/link";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
export const metadata = { title: "Terms of Service", robots: { index: false } };
// Placeholder: the legal copy is being supplied separately and must not be
// invented here. Not indexed until real text lands.
export default function Page() {
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[160px] pb-24 px-6"><div className="max-w-[640px] mx-auto">
        <h1 className="text-[32px] font-bold tracking-[-0.03em]">Terms of Service</h1>
        <p className="mt-4 text-[15px] text-white/[0.6]">This page is being finalized. Until it is published, questions about the terms of using SFB Connect can be sent through the <Link href="/#book-a-demo" className="underline underline-offset-2 text-white">contact form</Link>.</p>
      </div></section>
      <Footer />
    </main>
  );
}
