import Link from "next/link";
import { GitCompare } from "lucide-react";
import { notFound } from "next/navigation";
import { api } from "@/lib/api-client";
import type { FightSummaryDto } from "@ufc-intelligence/types";
import { MethodBreakdownChart } from "@/components/charts/method-breakdown-chart";
import { EloHistoryChart } from "@/components/charts/elo-history-chart";
import { FighterRadarChart } from "@/components/charts/fighter-radar-chart";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { PhotoAttribution } from "@/components/ui/photo-attribution";
import { PerformanceProfile } from "@/components/ui/performance-profile";
import { FightHistoryList } from "@/components/ui/fight-history-list";

function opponentOf(fight: FightSummaryDto, fighterId: string) {
  return fight.fighterA.id === fighterId ? fight.fighterB : fight.fighterA;
}

function formatFightDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function FighterDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fighter = await api.fighters.getBySlug(slug).catch(() => null);

  if (!fighter) {
    notFound();
  }

  const record = `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}`;

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12 md:px-8">
      <Link
        href="/fighters"
        className="text-xs text-text-secondary transition-standard hover:text-gold-300"
      >
        ← All fighters
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[320px_1fr]">
        <div>
          <div className="h-[400px] overflow-hidden rounded-lg bg-bg-elevated">
            <FighterAvatar name={fighter.name} photoUrl={fighter.photoUrl} />
          </div>
          {fighter.photoUrl && (
            <PhotoAttribution
              credit={fighter.photoCredit}
              license={fighter.photoLicense}
              licenseUrl={fighter.photoLicenseUrl}
            />
          )}
        </div>

        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-display-md text-text-primary">
              {fighter.name}
            </h1>
            {fighter.rank !== null && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-300 font-display text-sm font-medium text-text-on-gold">
                {fighter.rank === 0 ? "C" : fighter.rank}
              </span>
            )}
          </div>
          {fighter.nickname && (
            <p className="mt-1 text-body-lg text-gold-300">
              &ldquo;{fighter.nickname}&rdquo;
            </p>
          )}
          <p className="mt-2 text-body-md text-text-secondary">
            {record} {fighter.weightClass ? `· ${fighter.weightClass.name}` : ""}
          </p>

          {/* Omitted entirely when null (insufficient fight history) -
              see FighterCard for the same reasoning: no placeholder, no
              default 1500, nothing that could be mistaken for a real
              rating. */}
          {fighter.elo !== null && (
            <div className="mt-3 inline-flex items-center gap-4 rounded-md border border-border bg-bg-elevated px-4 py-2.5">
              <div>
                <p className="text-caption text-text-secondary">Elo rating</p>
                <p className="font-display text-heading-sm tabular-nums text-gold-300">
                  {Math.round(fighter.elo)}
                </p>
              </div>
              {fighter.eloRank !== null && (
                <div className="border-l border-border pl-4">
                  <p className="text-caption text-text-secondary">Elo rank</p>
                  <p className="font-display text-heading-sm tabular-nums text-text-primary">
                    #{fighter.eloRank}
                  </p>
                </div>
              )}
              <div className="border-l border-border pl-4">
                <p className="text-caption text-text-secondary">Fights</p>
                <p className="font-display text-heading-sm tabular-nums text-text-primary">
                  {fighter.eloFightCount}
                </p>
              </div>
            </div>
          )}

          <PerformanceProfile tags={fighter.performanceProfile} />

          <Link
            href={`/compare?fighters=${fighter.slug}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-standard hover:border-gold-500 hover:text-gold-300"
          >
            <GitCompare size={14} strokeWidth={1.75} />
            Compare with another fighter
          </Link>

          {fighter.upcomingFight && (
            <Link
              href={`/fights/${fighter.upcomingFight.id}`}
              className="mt-4 block rounded-lg border border-gold-500 bg-gold-900/20 p-4 transition-standard hover:bg-gold-900/30"
            >
              <p className="text-caption text-gold-300">
                Upcoming · {formatFightDate(fighter.upcomingFight.event.date)}
              </p>
              <p className="mt-1 text-body-md text-text-primary">
                vs {opponentOf(fighter.upcomingFight, fighter.id).name} ·{" "}
                {fighter.upcomingFight.event.name}
              </p>
            </Link>
          )}

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Sig. strike accuracy" value={formatPct(fighter.careerStats.sigStrikeAccuracyPct)} />
            <Stat label="Strikes landed / min" value={formatRate(fighter.careerStats.sigStrikesLandedPerMin)} />
            <Stat label="Takedown avg / 15 min" value={formatRate(fighter.careerStats.takedownAvgPer15Min)} />
            <Stat label="Takedown defense" value={formatPct(fighter.careerStats.takedownDefensePct)} />
            <Stat label="Height" value={fighter.heightCm ? `${fighter.heightCm} cm` : "—"} />
            <Stat label="Reach" value={fighter.reachCm ? `${fighter.reachCm} cm` : "—"} />
            <Stat label="Nationality" value={fighter.nationality ?? "—"} />
            <Stat label="Submission avg / 15 min" value={formatRate(fighter.careerStats.submissionAvgPer15Min)} />
          </div>

          {fighter.eloHistory.length >= 2 && (
            <div className="mt-12">
              <h2 className="font-display text-heading-md text-text-primary">
                Elo history
              </h2>
              <div className="mt-4 rounded-lg border border-border bg-bg-elevated p-4">
                <EloHistoryChart history={fighter.eloHistory} />
              </div>
            </div>
          )}

          {fighter.percentileProfile && (
            <div className="mt-12">
              <h2 className="font-display text-heading-md text-text-primary">
                Performance profile
              </h2>
              <div className="mt-4 rounded-lg border border-border bg-bg-elevated p-4">
                <FighterRadarChart fighterName={fighter.name} percentiles={fighter.percentileProfile} />
              </div>
            </div>
          )}

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
            <div className="mt-4">
              <FightHistoryList fights={fighter.recentFights} fighterId={fighter.id} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function formatPct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function formatRate(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
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
