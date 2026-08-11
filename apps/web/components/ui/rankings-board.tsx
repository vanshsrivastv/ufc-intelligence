"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { RankingEntryDto, WeightClassDto } from "@ufc-intelligence/types";
import { api } from "@/lib/api-client";
import { sortDivisions } from "@/lib/ranking-divisions";

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
  const [activeClass, setActiveClass] = useState(initialClass ?? divisions[0]?.name ?? null);
  const [rankings, setRankings] = useState(initialRankings);
  const [visible, setVisible] = useState(true);
  const [isPending, startTransition] = useTransition();

  function selectDivision(name: string) {
    if (name === activeClass) return;
    setVisible(false);
    setTimeout(async () => {
      const next = await api.rankings.list(name);
      startTransition(() => {
        setActiveClass(name);
        setRankings(next);
        setVisible(true);
      });
    }, 150);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Weight class">
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
          updates it. Worth saying plainly now that this board also shows
          an Elo-rank comparison next to each fighter: that comparison is
          only as fresh as this date, not a live-vs-live comparison. */}
      {rankings[0]?.effectiveDate && (
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

      <div
        className={`mt-8 divide-y divide-border rounded-lg border border-glass bg-glass backdrop-blur-2xl backdrop-saturate-150 shadow-glass transition-standard ${
          visible && !isPending ? "opacity-100" : "opacity-0"
        }`}
      >
        {rankings.length === 0 && divisions.length > 0 && (
          <p className="p-4 text-body-md text-text-muted">
            No rankings recorded yet for {activeClass}.
          </p>
        )}
        {rankings.map((entry) => (
          <RankingRow key={entry.fighter.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function RankingRow({ entry }: { entry: RankingEntryDto }) {
  const isChampion = entry.rank === 0;

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
        {/* Omitted entirely when null (no computed Elo) rather than a
            placeholder - same reasoning as everywhere else Elo shows up
            in this app. */}
        {entry.eloRank !== null && (
          <span className="text-[11px] text-text-secondary">
            Elo <span className="font-medium text-text-primary">#{entry.eloRank}</span>
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
