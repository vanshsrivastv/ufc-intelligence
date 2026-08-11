"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { RankingEntryDto, WeightClassDto } from "@ufc-intelligence/types";
import { api } from "@/lib/api-client";
import { sortDivisions } from "@/lib/ranking-divisions";

type RankingMode = "official" | "elo";

export function RankingsBoard({
  weightClasses,
  initialClass,
  initialRankings,
}: {
  weightClasses: WeightClassDto[];
  initialClass: string | null;
  initialRankings: RankingEntryDto[];
}) {
  const divisions = sortDivisions(weightClasses);
  const [mode, setMode] = useState<RankingMode>("official");
  const [activeClass, setActiveClass] = useState(initialClass ?? divisions[0]?.name ?? null);
  const [rankings, setRankings] = useState(initialRankings);
  const [visible, setVisible] = useState(true);
  const [isPending, startTransition] = useTransition();

  function fetchRankings(nextMode: RankingMode, name: string) {
    return nextMode === "official" ? api.rankings.list(name) : api.rankings.listByElo(name);
  }

  function selectDivision(name: string) {
    if (name === activeClass) return;
    setVisible(false);
    setTimeout(async () => {
      const next = await fetchRankings(mode, name);
      startTransition(() => {
        setActiveClass(name);
        setRankings(next);
        setVisible(true);
      });
    }, 150);
  }

  function selectMode(nextMode: RankingMode) {
    if (nextMode === mode || !activeClass) return;
    setVisible(false);
    setTimeout(async () => {
      const next = await fetchRankings(nextMode, activeClass);
      startTransition(() => {
        setMode(nextMode);
        setRankings(next);
        setVisible(true);
      });
    }, 150);
  }

  return (
    <div>
      <div className="flex gap-2" role="tablist" aria-label="Ranking type">
        <button
          role="tab"
          aria-selected={mode === "official"}
          onClick={() => selectMode("official")}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-standard ${
            mode === "official"
              ? "border-gold-500 bg-gold-900 text-gold-300"
              : "border-border text-text-secondary hover:border-border-strong"
          }`}
        >
          Official rankings
        </button>
        <button
          role="tab"
          aria-selected={mode === "elo"}
          onClick={() => selectMode("elo")}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-standard ${
            mode === "elo"
              ? "border-gold-500 bg-gold-900 text-gold-300"
              : "border-border text-text-secondary hover:border-border-strong"
          }`}
        >
          Elo rankings
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Weight class">
        {divisions.map((wc) => (
          <button
            key={wc.id}
            role="tab"
            aria-selected={wc.name === activeClass}
            onClick={() => selectDivision(wc.name)}
            className={`rounded-md border px-3 py-1.5 text-xs transition-standard ${
              wc.name === activeClass
                ? "border-gold-500 text-gold-300"
                : "border-border text-text-secondary hover:border-border-strong"
            }`}
          >
            {wc.name}
          </button>
        ))}
      </div>

      {divisions.length === 0 && (
        <p className="mt-8 text-body-md text-text-muted">
          No weight classes yet — run the database import to load fighter data.
        </p>
      )}

      {/* Official rankings are a hand-maintained snapshot (see
          seed-rankings.ts), not a live feed - re-run only when someone
          updates it. The Elo tab has no equivalent "as of" date since
          it's recomputed from the live database on every request. */}
      {mode === "official" && rankings[0]?.effectiveDate && (
        <p className="mt-2 text-[11px] text-text-muted">
          Official rankings as of{" "}
          {new Date(rankings[0].effectiveDate).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          . Elo updates continuously as new results sync.
        </p>
      )}
      {mode === "elo" && (
        <p className="mt-2 text-[11px] text-text-muted">
          Every fighter in this division with a computed Elo rating, ranked purely by rating - not
          an official UFC ranking.
        </p>
      )}

      <div
        className={`mt-8 divide-y divide-border rounded-lg border border-glass bg-glass backdrop-blur-2xl backdrop-saturate-150 shadow-glass transition-standard ${
          visible && !isPending ? "opacity-100" : "opacity-0"
        }`}
      >
        {rankings.length === 0 && divisions.length > 0 && (
          <p className="p-4 text-body-md text-text-muted">
            {mode === "official"
              ? `No rankings recorded yet for ${activeClass}.`
              : `No fighter in ${activeClass} has a computed Elo rating yet.`}
          </p>
        )}
        {rankings.map((entry) => (
          <RankingRow key={entry.fighter.id} entry={entry} mode={mode} />
        ))}
      </div>
    </div>
  );
}

function RankingRow({ entry, mode }: { entry: RankingEntryDto; mode: RankingMode }) {
  // Rank 0 = champion is an official-UFC-title concept; the Elo tab has
  // no notion of holding a title, so #1 there is shown the same as every
  // other position, never the gold "C" badge.
  const isChampion = mode === "official" && entry.rank === 0;

  return (
    <Link
      href={`/fighters/${entry.fighter.slug}`}
      className="flex items-center justify-between gap-4 p-4 transition-standard hover:bg-bg-elevated-2"
    >
      <div className="flex items-center gap-4">
        {isChampion ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-300 font-display text-sm font-medium text-text-on-gold">
            C
          </span>
        ) : (
          <span className="w-8 text-center font-display text-body-lg font-medium text-gold-300">
            #{entry.rank}
          </span>
        )}
        <div>
          <p className="text-body-md text-text-primary">{entry.fighter.name}</p>
          <p className="text-xs text-text-secondary">
            {entry.fighter.record.wins}-{entry.fighter.record.losses}-
            {entry.fighter.record.draws}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Only shown in official mode - in the Elo tab the list is
            already sorted by Elo, so a second "Elo #N" badge next to the
            identical #N on the left would be pure redundancy. Omitted
            entirely (not a placeholder) when null, same reasoning as
            everywhere else Elo shows up in this app. */}
        {mode === "official" && entry.eloRank !== null && (
          <span className="text-[11px] text-text-secondary">
            Elo <span className="font-medium text-text-primary">#{entry.eloRank}</span>
          </span>
        )}
        {mode === "elo" && (
          <span className="text-[11px] font-medium tabular-nums text-gold-300">
            {entry.fighter.elo !== null ? Math.round(entry.fighter.elo) : "—"}
          </span>
        )}
        <StatusBadge status={entry.status} />
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-success" : "bg-text-muted"}`}
      />
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}
