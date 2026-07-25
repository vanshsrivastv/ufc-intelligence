import { notFound } from "next/navigation";
import { api } from "@/lib/api-client";
import { MethodBreakdownChart } from "@/components/charts/method-breakdown-chart";
import { EmptyState } from "@/components/ui/empty-state";

export default async function FighterDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const fighter = await api.fighters.getBySlug(params.slug).catch(() => null);

  if (!fighter) {
    notFound();
  }

  const record = `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}`;

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        <div className="h-[400px] rounded-lg bg-bg-elevated" />

        <div>
          <h1 className="font-display text-display-md text-text-primary">
            {fighter.name}
          </h1>
          {fighter.nickname && (
            <p className="mt-1 text-body-lg text-gold-300">
              &ldquo;{fighter.nickname}&rdquo;
            </p>
          )}
          <p className="mt-2 text-body-md text-text-secondary">
            {record} {fighter.weightClass ? `· ${fighter.weightClass.name}` : ""}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Sig. strike accuracy" value={`${fighter.careerStats.sigStrikeAccuracyPct}%`} />
            <Stat label="Height" value={fighter.heightCm ? `${fighter.heightCm} cm` : "—"} />
            <Stat label="Reach" value={fighter.reachCm ? `${fighter.reachCm} cm` : "—"} />
            <Stat label="Nationality" value={fighter.nationality ?? "—"} />
          </div>

          <div className="mt-12">
            <h2 className="font-display text-heading-md text-text-primary">
              Win method breakdown
            </h2>
            <div className="mt-4 rounded-lg border border-border bg-bg-elevated p-4">
              <MethodBreakdownChart
                koTko={fighter.careerStats.koTkoWins}
                submission={fighter.careerStats.submissionWins}
                decision={fighter.careerStats.decisionWins}
              />
            </div>
          </div>

          <div className="mt-12">
            <h2 className="font-display text-heading-md text-text-primary">
              Recent fights
            </h2>
            <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-bg-elevated">
              {fighter.recentFights.length === 0 && (
                <EmptyState message="No fight history recorded yet." />
              )}
              {fighter.recentFights.map((fight) => (
                <div key={fight.id} className="flex items-center justify-between p-4">
                  <span className="text-body-md text-text-primary">
                    {fight.fighterA.name} vs {fight.fighterB.name}
                  </span>
                  <span className="text-xs text-text-secondary">{fight.method}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated p-3">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 font-sans text-body-lg font-medium tabular-nums text-text-primary">
        {value}
      </p>
    </div>
  );
}
