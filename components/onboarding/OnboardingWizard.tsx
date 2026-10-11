"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  business: {
    legalName: string;
    website: string;
    primaryCategory: string;
    description: string;
    yearsInBusiness: string;
  };
  location: {
    primaryAddress: string;
    serviceAreas: string;
    cities: string;
    states: string;
    radiusMiles: string;
  };
  services: {
    primaryService: string;
    additionalServices: string;
    specialties: string;
    priceRange: string;
    idealCustomer: string;
  };
  presence: {
    googleBusinessProfileUrl: string;
    facebook: string;
    instagram: string;
    tiktok: string;
    linkedin: string;
    youtube: string;
    otherDirectories: string;
  };
  competitors: string;
};

const INITIAL_STATE: FormState = {
  business: {
    legalName: "",
    website: "",
    primaryCategory: "",
    description: "",
    yearsInBusiness: "",
  },
  location: {
    primaryAddress: "",
    serviceAreas: "",
    cities: "",
    states: "",
    radiusMiles: "",
  },
  services: {
    primaryService: "",
    additionalServices: "",
    specialties: "",
    priceRange: "",
    idealCustomer: "",
  },
  presence: {
    googleBusinessProfileUrl: "",
    facebook: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
    youtube: "",
    otherDirectories: "",
  },
  competitors: "",
};

const STEPS = ["Business", "Location", "Services", "Presence", "Competition"];

function splitList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] text-medium-gray">{label}</span>
      <input
        {...props}
        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/40"
      />
    </label>
  );
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, patch: Partial<FormState[K]>) {
    setForm((f) => ({ ...f, [key]: { ...(f[key] as object), ...patch } as FormState[K] }));
  }

  async function handleFinalSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business: form.business,
          location: {
            primaryAddress: form.location.primaryAddress,
            serviceAreas: splitList(form.location.serviceAreas),
            cities: splitList(form.location.cities),
            states: splitList(form.location.states),
            radiusMiles: form.location.radiusMiles ? Number(form.location.radiusMiles) : undefined,
          },
          services: {
            primaryService: form.services.primaryService,
            additionalServices: splitList(form.services.additionalServices),
            specialties: splitList(form.services.specialties),
            priceRange: form.services.priceRange,
            idealCustomer: form.services.idealCustomer,
          },
          presence: {
            ...form.presence,
            otherDirectories: splitList(form.presence.otherDirectories),
          },
          competitors: splitList(form.competitors),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not complete onboarding.");
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const isLast = step === STEPS.length - 1;

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-[560px] mx-auto">
        <div className="font-extrabold text-lg mb-3 text-center">
          SFB <span className="text-medium-gray font-semibold">CONNECT</span>
        </div>
        <p className="text-center text-medium-gray text-sm mb-10">
          Tell Us About Your Business
        </p>

        <div className="flex justify-center gap-2 mb-12">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-white" : i < step ? "w-4 bg-white/50" : "w-4 bg-white/15"
              }`}
            />
          ))}
        </div>

        <div className="glass rounded-[28px] p-9">
          <div className="text-xs font-mono uppercase tracking-widest text-medium-gray mb-6">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </div>

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <Field
                label="Legal / public business name"
                required
                value={form.business.legalName}
                onChange={(e) => update("business", { legalName: e.target.value })}
              />
              <Field
                label="Website"
                value={form.business.website}
                onChange={(e) => update("business", { website: e.target.value })}
              />
              <Field
                label="Primary category"
                value={form.business.primaryCategory}
                onChange={(e) => update("business", { primaryCategory: e.target.value })}
              />
              <Field
                label="Description"
                value={form.business.description}
                onChange={(e) => update("business", { description: e.target.value })}
              />
              <Field
                label="Years in business"
                value={form.business.yearsInBusiness}
                onChange={(e) => update("business", { yearsInBusiness: e.target.value })}
              />
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Field
                label="Primary address"
                value={form.location.primaryAddress}
                onChange={(e) => update("location", { primaryAddress: e.target.value })}
              />
              <Field
                label="Service areas (comma separated)"
                value={form.location.serviceAreas}
                onChange={(e) => update("location", { serviceAreas: e.target.value })}
              />
              <Field
                label="Cities (comma separated)"
                value={form.location.cities}
                onChange={(e) => update("location", { cities: e.target.value })}
              />
              <Field
                label="States (comma separated)"
                value={form.location.states}
                onChange={(e) => update("location", { states: e.target.value })}
              />
              <Field
                label="Distance / radius served (miles)"
                type="number"
                value={form.location.radiusMiles}
                onChange={(e) => update("location", { radiusMiles: e.target.value })}
              />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <Field
                label="Primary service"
                value={form.services.primaryService}
                onChange={(e) => update("services", { primaryService: e.target.value })}
              />
              <Field
                label="Additional services (comma separated)"
                value={form.services.additionalServices}
                onChange={(e) => update("services", { additionalServices: e.target.value })}
              />
              <Field
                label="Specialties (comma separated)"
                value={form.services.specialties}
                onChange={(e) => update("services", { specialties: e.target.value })}
              />
              <Field
                label="Price range"
                value={form.services.priceRange}
                onChange={(e) => update("services", { priceRange: e.target.value })}
              />
              <Field
                label="Ideal customer"
                value={form.services.idealCustomer}
                onChange={(e) => update("services", { idealCustomer: e.target.value })}
              />
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <Field
                label="Google Business Profile URL"
                value={form.presence.googleBusinessProfileUrl}
                onChange={(e) => update("presence", { googleBusinessProfileUrl: e.target.value })}
              />
              <Field
                label="Facebook"
                value={form.presence.facebook}
                onChange={(e) => update("presence", { facebook: e.target.value })}
              />
              <Field
                label="Instagram"
                value={form.presence.instagram}
                onChange={(e) => update("presence", { instagram: e.target.value })}
              />
              <Field
                label="TikTok"
                value={form.presence.tiktok}
                onChange={(e) => update("presence", { tiktok: e.target.value })}
              />
              <Field
                label="LinkedIn"
                value={form.presence.linkedin}
                onChange={(e) => update("presence", { linkedin: e.target.value })}
              />
              <Field
                label="YouTube"
                value={form.presence.youtube}
                onChange={(e) => update("presence", { youtube: e.target.value })}
              />
              <Field
                label="Other directories (comma separated)"
                value={form.presence.otherDirectories}
                onChange={(e) => update("presence", { otherDirectories: e.target.value })}
              />
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <Field
                label="Competitors (comma separated)"
                value={form.competitors}
                onChange={(e) => setForm((f) => ({ ...f, competitors: e.target.value }))}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400 mt-5">{error}</p>}

          <div className="flex justify-between mt-9">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-6 py-3 rounded-full text-sm font-medium text-medium-gray disabled:opacity-30"
            >
              Back
            </button>

            {!isLast ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="bg-white text-black px-7 py-3 rounded-full text-sm font-semibold hover:scale-[1.02] transition-transform"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleFinalSubmit}
                className="bg-white text-black px-7 py-3 rounded-full text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Finish Onboarding"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
