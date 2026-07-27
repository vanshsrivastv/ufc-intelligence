import Link from "next/link";
import { api } from "@/lib/api-client";
import type { LeaderboardEntry } from "@/lib/api-client";
import { EmptyState } from "@/components/ui/empty-state";

export default async function StatisticsPage() {
  let lb;
  try {
    lb = await api.stats.getLeaderboards();
  } catch {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-12 md:px-8">
        <h1 className="font-display text-heading-lg text-text-primary">Statistics</h1>
        <EmptyState message="Couldn't load statistics right now — try refreshing in a moment." />
      </main>
    );
  }
  const { methodBreakdown } = lb;

  const koPct = methodBreakdown.total > 0 ? Math.round((methodBreakdown.koTko / methodBreakdown.total) * 100) : 0;
  const subPct = methodBreakdown.total > 0 ? Math.round((methodBreakdown.submission / methodBreakdown.total) * 100) : 0;
  const decPct = methodBreakdown.total > 0 ? Math.round((methodBreakdown.decision / methodBreakdown.total) * 100) : 0;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-12 md:px-8">
      <h1 className="font-display text-heading-lg text-text-primary">
        Statistics
      </h1>
      <p className="mt-1 text-body-md text-text-secondary">
        Real leaderboards computed from every recorded UFC fight in the database.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Leaderboard title="Most wins" entries={lb.mostWins} valueKey="wins" />
        <Leaderboard title="Most finishes" entries={lb.mostFinishes} valueKey="finishes" />
        <Leaderboard title="Longest win streak" entries={lb.longestWinStreak} valueKey="streak" />
        <Leaderboard title="Most KO/TKO wins" entries={lb.mostKOWins} valueKey="kos" />
        <Leaderboard title="Most submission wins" entries={lb.mostSubmissionWins} valueKey="submissions" />
        <Leaderboard title="Most title fights" entries={lb.mostTitleFights} valueKey="titleFights" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <Leaderboard
            title="Best striking accuracy (200+ attempts)"
            entries={lb.bestStrikeAccuracy}
            valueKey="accuracyPct"
            suffix="%"
          />
        </div>

        <div className="rounded-lg border border-border bg-bg-elevated p-6">
          <p className="font-display text-heading-md text-text-primary">
            Method of victory (all recorded fights)
          </p>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-bg-elevated-2">
            <div className="h-full bg-gold-300" style={{ width: `${koPct}%` }} />
            <div className="h-full bg-gold-700" style={{ width: `${subPct}%` }} />
            <div className="h-full bg-text-secondary" style={{ width: `${decPct}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <MethodLegend colorClass="bg-gold-300" label="KO/TKO" pct={koPct} />
            <MethodLegend colorClass="bg-gold-700" label="Submission" pct={subPct} />
            <MethodLegend colorClass="bg-text-secondary" label="Decision" pct={decPct} />
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Based on {methodBreakdown.total.toLocaleString()} decided fights.
          </p>
        </div>
      </div>
    </main>
  );
}

function Leaderboard({
  title,
  entries,
  valueKey,
  suffix = "",
}: {
  title: string;
  entries: LeaderboardEntry[];
  valueKey: keyof LeaderboardEntry;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <p className="font-display text-heading-md text-text-primary">{title}</p>
      <div className="mt-3 flex flex-col gap-1">
        {entries.map((entry, i) => (
          <Link
            key={entry.id}
            href={`/fighters/${entry.slug}`}
            className="flex items-center justify-between rounded-md px-2 py-2 transition-standard hover:bg-bg-elevated-2"
          >
            <div className="flex items-center gap-3">
              <span className="w-5 text-xs text-text-muted">{i + 1}</span>
              <span className="text-body-md text-text-primary">{entry.name}</span>
            </div>
            <span className="text-body-md font-medium text-gold-300">
              {entry[valueKey]}
              {suffix}
            </span>
          </Link>
        ))}
        {entries.length === 0 && (
          <p className="px-2 py-2 text-body-md text-text-muted">No data yet.</p>
        )}
      </div>
    </div>
  );
}

function MethodLegend({
  colorClass,
  label,
  pct,
}: {
  colorClass: string;
  label: string;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
      <span className="text-xs text-text-secondary">
        {label} — {pct}%
      </span>
    </div>
  );
}