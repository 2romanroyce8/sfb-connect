"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type VerifiedField<T> = {
  value: T | null;
  status: "confirmed" | "uncertain" | "not_found";
  confidence: number;
  sources: string[];
};

export type LookupResult = {
  business: {
    name: VerifiedField<string>;
    website: VerifiedField<string>;
    phone: VerifiedField<string>;
    location: VerifiedField<string>;
    category: VerifiedField<string>;
  };
  scores: {
    overall: number;
    identity: number;
    knowledge: number;
    authority: number;
    location: number;
    machineReadability: number;
  };
  strengths: string[];
  gaps: string[];
  missing: string[];
  sources: string[];
};

export type AISummary = {
  headline: string;
  summary: string;
  whatAIUnderstands: string[];
  whatMayBeMissing: string[];
  whyScoreIsWhatItIs: string;
  recommendedNextSteps: string[];
};

type BusinessLookupContextValue = {
  selectedBusiness: LookupResult | null;
  summary: AISummary | null;
  setLookupResult: (result: LookupResult | null, summary: AISummary | null) => void;
  openChatWithMessage: (message: string) => void;
  pendingChatMessage: string | null;
  clearPendingChatMessage: () => void;
};

const BusinessLookupContext = createContext<BusinessLookupContextValue | null>(null);

export function BusinessLookupProvider({ children }: { children: ReactNode }) {
  const [selectedBusiness, setSelectedBusiness] = useState<LookupResult | null>(null);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null);

  function setLookupResult(result: LookupResult | null, newSummary: AISummary | null) {
    setSelectedBusiness(result);
    setSummary(newSummary);
  }

  function openChatWithMessage(message: string) {
    setPendingChatMessage(message);
    const el = document.getElementById("shift");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <BusinessLookupContext.Provider
      value={{
        selectedBusiness,
        summary,
        setLookupResult,
        openChatWithMessage,
        pendingChatMessage,
        clearPendingChatMessage: () => setPendingChatMessage(null),
      }}
    >
      {children}
    </BusinessLookupContext.Provider>
  );
}

export function useBusinessLookup() {
  const ctx = useContext(BusinessLookupContext);
  if (!ctx) {
    throw new Error("useBusinessLookup must be used within a BusinessLookupProvider");
  }
  return ctx;
}
