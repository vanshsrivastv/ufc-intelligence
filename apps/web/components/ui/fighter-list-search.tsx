"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FighterSummaryDto } from "@ufc-intelligence/types";
import { api } from "@/lib/api-client";

export function FighterListSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("search") ?? "");
  const [suggestions, setSuggestions] = useState<FighterSummaryDto[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("search", value);
        try {
          const result = await api.fighters.list({ search: value, pageSize: 6 });
          setSuggestions(result.items);
          setOpen(true);
        } catch {
          setSuggestions([]);
        }
      } else {
        params.delete("search");
        setSuggestions([]);
        setOpen(false);
      }
      params.delete("page"); // reset to page 1 on a new search
      router.push(`/fighters${params.toString() ? `?${params.toString()}` : ""}`);
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Search fighters by name..."
        className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-body-md text-text-primary outline-none transition-standard focus:border-gold-500"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border-strong bg-bg-elevated-2 shadow-lg">
          {suggestions.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/fighters/${f.slug}`);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-body-md text-text-primary transition-standard hover:bg-bg-elevated"
            >
              <span>{f.name}</span>
              <span className="text-xs text-text-secondary">
                {f.record.wins}-{f.record.losses}-{f.record.draws}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
