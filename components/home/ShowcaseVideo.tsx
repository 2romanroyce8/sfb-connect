import { createSupabaseServiceClient } from "@/lib/supabase/server";

// The showcase (Roman, 2026-10-15): the walkthrough video, big, full-width,
// directly under the hero and above "Your agent's first 7 days". Source is
// site_settings.walkthrough_video_url (set at /team/settings → Homepage
// video). No video set → this section renders nothing at all: no empty box,
// no mockup, no "coming" copy at this prominence.
export default async function ShowcaseVideo() {
  const { data } = await createSupabaseServiceClient().from("site_settings").select("walkthrough_video_url, walkthrough_poster_url").eq("id", 1).maybeSingle();
  const src = (data?.walkthrough_video_url as string | null) ?? null;
  if (!src) return null;
  const poster = (data?.walkthrough_poster_url as string | null) ?? null;
  return (
    <section id="showcase" className="px-6 pt-4 pb-16 md:pb-24 scroll-mt-24" style={{ background: "var(--hx-000000)" }} aria-label="Watch the SFB Agent at work">
      <div className="max-w-[1180px] mx-auto">
        <div className="rounded-[22px] overflow-hidden" style={{ border: "1px solid rgb(var(--w) / 0.12)", boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 120px rgba(66,227,109,0.12)" }}>
          <video controls preload="metadata" playsInline poster={poster ?? undefined} src={src} className="block w-full aspect-video bg-black" />
        </div>
      </div>
    </section>
  );
}
