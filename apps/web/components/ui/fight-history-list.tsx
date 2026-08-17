"use client";

import { useState } from "react";
import Link from "next/link";
import type { FightSummaryDto } from "@ufc-intelligence/types";
import { EmptyState } from "./empty-state";
import { METHOD_LABEL } from "@/lib/method-label";

const COLLAPSED_COUNT = 5;

function opponentOf(fight: FightSummaryDto, fighterId: string) {
  return fight.fighterA.id === fighterId ? fight.fighterB : fight.fighterA;
}

function formatFightDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// fighter.recentFights is the fighter's FULL completed history, not
// capped server-side (see fighters.service.ts) - a fighter with a long
// career (e.g. 37+ fights) would otherwise have most of their record
// permanently hidden with no way to see it. Collapsed to the first 5 by
// default here instead, with a "Show all" expansion.
export function FightHistoryList({ fights, fighterId }: { fights: FightSummaryDto[]; fighterId: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? fights : fights.slice(0, COLLAPSED_COUNT);
  const hiddenCount = fights.length - visible.length;

  return (
    <div>
      <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
        {fights.length === 0 && <EmptyState message="No fight history recorded yet." />}
        {visible.map((fight) => {
          const opponent = opponentOf(fight, fighterId);
          const won = fight.winnerId === fighterId;
          return (
            <Link
              key={fight.id}
              href={`/fights/${fight.id}`}
              className="flex items-center justify-between p-4 transition-standard hover:bg-bg-elevated-2"
            >
              <span className={`text-body-md ${won ? "font-medium text-gold-300" : "text-text-primary"}`}>
                {won ? "W" : fight.winnerId ? "L" : "—"} vs {opponent.name}
              </span>
              <span className="text-right text-xs text-text-secondary">
                {METHOD_LABEL[fight.method] ?? fight.method}
                <br />
                {formatFightDate(fight.event.date)}
              </span>
            </Link>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-md border border-border px-3 py-2 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
        >
          Show all {fights.length} fights
        </button>
      )}
      {expanded && fights.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 w-full rounded-md border border-border px-3 py-2 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
