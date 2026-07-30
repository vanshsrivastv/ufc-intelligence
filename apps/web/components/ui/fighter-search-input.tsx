"use client";

import { useState, useEffect, useRef } from "react";
import type { FighterSummaryDto } from "@ufc-intelligence/types";
import { api } from "@/lib/api-client";

export function FighterSearchInput({
  label,
  onSelect,
  genderFilter,
}: {
  label: string;
  onSelect: (fighter: FighterSummaryDto) => void;
  genderFilter?: "men" | "women";
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FighterSummaryDto[]>([]);
  const [selected, setSelected] = useState<FighterSummaryDto | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!query || selected) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.fighters.list({ search: query, gender: genderFilter, pageSize: 6 });
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      }
    }, 300);
  }, [query, selected, genderFilter]);

  function handlePick(fighter: FighterSummaryDto) {
    setSelected(fighter);
    setQuery(fighter.name);
    setResults([]);
    onSelect(fighter);
  }

  return (
    <div className="relative">
      <label className="text-caption text-text-secondary">{label}</label>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        placeholder="Search fighter name..."
        className="mt-1 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
      />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border-strong bg-bg-elevated-2 shadow-lg">
          {results.map((f) => (
            <button
              key={f.id}
              onClick={() => handlePick(f)}
              className="block w-full px-3 py-2 text-left text-body-md text-text-primary transition-standard hover:bg-bg-elevated"
            >
              {f.name}
              <span className="ml-2 text-xs text-text-secondary">
                {f.record.wins}-{f.record.losses}-{f.record.draws}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}