import Link from "next/link";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import LegalDocument from "@/components/legal/LegalDocument";
import { PRIVACY, isPublishable } from "@/lib/legal/documents";

// Copy is Muse's draft in lib/legal/documents.ts. While any [TO CONFIRM] /
// [DECISION] item is unresolved the page stays a noindex placeholder; the full
// draft is visible to the team at /team/legal. Nothing here is invented.
const published = isPublishable(PRIVACY);
export const metadata = { title: "Privacy Policy", robots: { index: published } };

export default function Page() {
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <section className="pt-[160px] pb-24 px-6">
        {published ? (
          <LegalDocument doc={PRIVACY} mode="public" />
        ) : (
          <div className="max-w-[640px] mx-auto">
            <h1 className="text-[32px] font-bold tracking-[-0.03em]">Privacy Policy</h1>
            <p className="mt-4 text-[15px] text-white/[0.6]">This page is being finalized. Until it is published, questions about how SFB Connect handles your information can be sent through the <Link href="/#book-a-demo" className="underline underline-offset-2 text-white">contact form</Link>.</p>
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}
