"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type Result = { id: string; business_name: string | null; phone: string | null; website: string | null; pipeline_stage: string };

export default function SidebarSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function onChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/team/search?q=${encodeURIComponent(value)}`);
      const data = await res.json();
      setResults(data.results || []);
      setOpen(true);
    }, 250);
  }

  return (
    <div ref={boxRef} className="relative px-3 py-2">
      <div
        className="flex items-center gap-2 h-[36px] rounded-[6px] px-2.5"
        style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Search size={13} className="text-[#6E6E73] shrink-0" />
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search anything"
          className="w-full bg-transparent outline-none text-[12.5px]"
          style={{ color: "#F5F5F7" }}
        />
      </div>
      {open && (
        <div
          className="absolute left-3 right-3 mt-1 rounded-[8px] overflow-hidden z-30"
          style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-[#6E6E73]">No leads match "{query}"</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  router.push(`/team/leads/${r.id}`);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#1c1c1c]"
              >
                <div className="text-[12.5px] text-[#F5F5F7] truncate">{r.business_name || "Unnamed lead"}</div>
                <div className="text-[11px] text-[#6E6E73] truncate">{r.website || r.phone || r.pipeline_stage}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
