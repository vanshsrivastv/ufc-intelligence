import { api } from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { sortDivisions } from "@/lib/ranking-divisions";
import { SandboxBanner } from "../_components/sandbox-banner";
import { PhotoHeader } from "../_components/photo-header";

// DESIGN SANDBOX - visual prototype only, real rankings data.
export default async function RankingsSandbox() {
  const weightClasses = await api.rankings.listWeightClasses().catch(() => []);
  const divisions = sortDivisions(weightClasses);
  const activeClass = divisions[0]?.name ?? null;
  const rankings = activeClass ? await api.rankings.list(activeClass).catch(() => []) : [];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-10 md:px-8">
      <SandboxBanner
        title="Rankings"
        liveHref="/rankings"
        liveLabel="the live Rankings page"
        applied={[
          "Header: flat surface instead of glass/blur (finding #1, #7)",
          "Division tabs: text-weight active state instead of a filled gold-tinted pill for every tab (finding #2, #5)",
          "Ranking rows: plain divided list, gold reserved for the champion slot and rank number only (finding #2)",
        ]}
      />

      <div className="mt-8">
        <PhotoHeader
          src="/images/chama.jpg"
          focalPosition="50% 25%"
          title="Rankings"
          description="Current divisional rankings, by weight class."
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4 text-body-md">
        {divisions.map((wc) => (
          <span
            key={wc.id}
            className={
              wc.name === activeClass
                ? "cursor-default font-medium text-text-primary underline decoration-gold-500 decoration-2 underline-offset-4"
                : "cursor-default text-text-secondary"
            }
          >
            {wc.name}
          </span>
        ))}
      </div>

      <div className="mt-6 divide-y divide-border">
        {rankings.map((entry) => (
          <div key={entry.fighter.id} className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-4">
              {entry.rank === 0 ? (
                <span className="w-8 text-center font-display text-body-lg font-medium text-gold-300">C</span>
              ) : (
                <span className="w-8 text-center font-display text-body-lg font-medium text-text-secondary">
                  {entry.rank}
                </span>
              )}
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border-strong">
                <FighterAvatar name={entry.fighter.name} photoUrl={entry.fighter.photoUrl} />
              </div>
              <div>
                <p className="text-body-md text-text-primary">{entry.fighter.name}</p>
                <p className="text-xs text-text-secondary">
                  {entry.fighter.record.wins}-{entry.fighter.record.losses}-{entry.fighter.record.draws}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-text-secondary">
              {entry.eloRank !== null && (
                <span>
                  Elo <span className="font-medium text-text-primary">#{entry.eloRank}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${entry.status === "active" ? "bg-success" : "bg-text-muted"}`}
                />
                {entry.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        ))}
        {rankings.length === 0 && <p className="py-6 text-body-md text-text-muted">No data yet.</p>}
      </div>
    </main>
  );
}
