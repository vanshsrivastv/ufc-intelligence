import { api } from "@/lib/api-client";
import type { LeaderboardEntry } from "@/lib/api-client";
import { SandboxBanner } from "../_components/sandbox-banner";
import { PhotoHeader } from "../_components/photo-header";

// DESIGN SANDBOX - visual prototype only, real leaderboard data. Shows
// only the "Records" tab's content (statically) to demonstrate the card
// treatment - the live page's tab-switching behavior is unchanged/not
// reproduced here since this is a visual-only exercise.
export default async function StatisticsSandbox() {
  const lb = await api.stats.getLeaderboards().catch(() => null);

  if (!lb) {
    return (
      <main className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
        <p className="text-body-md text-text-muted">Couldn&apos;t load sample statistics data.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <SandboxBanner
        title="Statistics"
        liveHref="/statistics"
        liveLabel="the live Statistics page"
        applied={[
          "Header: flat, sits directly above the tabs instead of its own separate glass panel (finding #1, #7)",
          "Tabs: text-weight active state instead of a filled gold pill (finding #2, #5)",
          "Leaderboards: one flat grid with column dividers instead of 6 individually-bordered cards (finding #6)",
        ]}
      />

      <div className="mt-8">
        <PhotoHeader
          src="/images/chama.jpg"
          focalPosition="50% 25%"
          title="Statistics"
          description="Real leaderboards computed from every recorded UFC fight in the database."
        />

        <div className="mt-5 flex gap-6 border-b border-border pb-3 text-body-md">
          <span className="cursor-default font-medium text-text-primary underline decoration-gold-500 decoration-2 underline-offset-4">
            Records
          </span>
          <span className="cursor-default text-text-secondary">Career milestones</span>
          <span className="cursor-default text-text-secondary">Elo</span>
        </div>
      </div>

      <div className="mt-6 grid divide-border sm:grid-cols-2 sm:divide-x lg:grid-cols-3">
        <ProposedLeaderboard title="Most wins" entries={lb.mostWins} valueKey="wins" />
        <ProposedLeaderboard title="Most finishes" entries={lb.mostFinishes} valueKey="finishes" />
        <ProposedLeaderboard title="Longest win streak" entries={lb.longestWinStreak} valueKey="streak" />
        <ProposedLeaderboard title="Most KO/TKO wins" entries={lb.mostKOWins} valueKey="kos" />
        <ProposedLeaderboard title="Most submission wins" entries={lb.mostSubmissionWins} valueKey="submissions" />
        <ProposedLeaderboard title="Most active fighters" entries={lb.mostActiveFighters} valueKey="fights" />
      </div>
    </main>
  );
}

function ProposedLeaderboard({
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
    <div className="px-4 py-4 first:pl-0">
      <p className="font-display text-heading-sm text-text-primary">{title}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {entries.slice(0, 6).map((entry, i) => (
          <div key={entry.id} className="flex items-center justify-between text-body-md">
            <span className="text-text-primary">
              <span className="mr-2 text-xs text-text-muted">{i + 1}</span>
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-gold-300">
              {entry[valueKey]}
              {suffix}
            </span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-body-md text-text-muted">No data yet.</p>}
      </div>
    </div>
  );
}
