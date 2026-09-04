import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

const cards = [
  { title: "Reviews", statement: "Important. Not the entire picture." },
  { title: "Website", statement: "Important. Not enough by itself." },
  { title: "Logo", statement: "Great for humans. Limited machine context." },
  {
    title: "Service",
    statement:
      "Excellent service matters, but AI still needs evidence and information it can understand.",
  },
];

export default function MythSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="myth">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="The Misconception"
            title="The prettiest business doesn't automatically win."
          />
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {cards.map((c) => (
              <div
                key={c.title}
                className="glass rounded-3xl p-8"
              >
                <h3 className="text-lg font-bold mb-3.5">{c.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-medium-gray">
                  {c.statement}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-12 text-xl font-semibold max-w-[700px] leading-relaxed">
            A strong business must also represent itself clearly to the
            machines helping humans make decisions.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
