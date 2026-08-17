"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const TABS = [
  { id: "records", label: "Records" },
  { id: "milestones", label: "Career milestones" },
  { id: "elo", label: "Elo" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// 12 leaderboards used to render as one long stacked scroll with no way
// to jump to "the one I want" - same role="tablist"/role="tab" pattern
// RankingsBoard already uses for its weight-class switcher, so this reads
// as the same interaction the user's already seen elsewhere on the site.
export function StatisticsTabs({
  records,
  milestones,
  elo,
}: {
  records: ReactNode;
  milestones: ReactNode;
  elo: ReactNode;
}) {
  const [active, setActive] = useState<TabId>("records");
  const content: Record<TabId, ReactNode> = { records, milestones, elo };

  return (
    <div>
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Statistics category">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`rounded-md border px-4 py-2 text-body-md transition-standard ${
              active === tab.id
                ? "border-gold-500 bg-gold-900 text-gold-300"
                : "border-border text-text-secondary hover:border-border-strong"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">{content[active]}</div>
    </div>
  );
}
