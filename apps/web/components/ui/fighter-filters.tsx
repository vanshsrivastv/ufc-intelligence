"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import type { WeightClassDto } from "@ufc-intelligence/types";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "documented_first", label: "Fight history first" },
  { value: "name_asc", label: "Alphabetical (A–Z)" },
  { value: "recent", label: "Recently added" },
  { value: "oldest", label: "Oldest added" },
  { value: "elo_desc", label: "Elo: Highest → Lowest" },
  { value: "elo_asc", label: "Elo: Lowest → Highest" },
];

export function FighterFilters({ weightClasses }: { weightClasses: WeightClassDto[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Collapsed by default on mobile only - the md:flex below always shows
  // the row regardless of this state once the viewport is wide enough
  // that 2 selects + 6 pills don't push every fighter card below the
  // fold. Desktop layout is completely unaffected by this state.
  const [mobileOpen, setMobileOpen] = useState(false);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // any filter change resets to page 1
    router.push(`/fighters${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function toggleParam(key: string, value: string) {
    setParam(key, searchParams.get(key) === value ? null : value);
  }

  const gender = searchParams.get("gender");
  const activity = searchParams.get("activity");
  const championOnly = searchParams.get("championOnly") === "true";
  const documentedOnly = searchParams.get("documentedOnly") === "true";
  const weightClass = searchParams.get("weightClass") ?? "";
  const sort = searchParams.get("sort") ?? "elo_desc";

  const activeCount = [weightClass !== "", gender !== null, activity !== null, championOnly, documentedOnly].filter(
    Boolean,
  ).length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 py-2 text-xs text-text-secondary transition-standard md:hidden"
        aria-expanded={mobileOpen}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={14} strokeWidth={1.75} />
          Filters & sort
          {activeCount > 0 && (
            <span className="rounded-full bg-gold-900 px-1.5 py-0.5 text-[10px] font-medium text-gold-300">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`transition-standard ${mobileOpen ? "rotate-180" : ""}`}
        />
      </button>

      <div className={`mt-2 flex-wrap items-center gap-2 md:mt-0 md:flex ${mobileOpen ? "flex" : "hidden"}`}>
      <select
        value={weightClass}
        onChange={(e) => setParam("weightClass", e.target.value || null)}
        className="rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none transition-standard focus:border-gold-500"
      >
        <option value="">All weight classes</option>
        {weightClasses.map((wc) => (
          <option key={wc.id} value={wc.name}>
            {wc.name}
          </option>
        ))}
      </select>

      <FilterPill active={gender === "men"} onClick={() => toggleParam("gender", "men")}>
        Men
      </FilterPill>
      <FilterPill active={gender === "women"} onClick={() => toggleParam("gender", "women")}>
        Women
      </FilterPill>

      <div className="h-4 w-px bg-border" />

      <FilterPill
        active={activity === "active"}
        onClick={() => toggleParam("activity", "active")}
      >
        Active
      </FilterPill>
      <FilterPill
        active={activity === "inactive"}
        onClick={() => toggleParam("activity", "inactive")}
      >
        Inactive
      </FilterPill>

      <div className="h-4 w-px bg-border" />

      <FilterPill
        active={championOnly}
        onClick={() => setParam("championOnly", championOnly ? null : "true")}
      >
        Champions only
      </FilterPill>

      <FilterPill
        active={documentedOnly}
        onClick={() => setParam("documentedOnly", documentedOnly ? null : "true")}
      >
        Fight data available
      </FilterPill>

      <select
        value={sort}
        onChange={(e) => setParam("sort", e.target.value)}
        className="ml-auto rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none transition-standard focus:border-gold-500"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Sort: {opt.label}
          </option>
        ))}
      </select>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-3 py-1.5 text-xs transition-standard ${
        active
          ? "border-gold-500 bg-gold-900 text-gold-300"
          : "border-border text-text-secondary hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}
