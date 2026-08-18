import { api } from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { PhotoAttribution } from "@/components/ui/photo-attribution";
import { EloHistoryChart } from "@/components/charts/elo-history-chart";
import { MethodBreakdownChart } from "@/components/charts/method-breakdown-chart";
import { FighterRadarChart } from "@/components/charts/fighter-radar-chart";
import { METHOD_LABEL } from "@/lib/method-label";
import { SandboxBanner } from "../_components/sandbox-banner";
import { PhotoHeader } from "../_components/photo-header";
import type { FightSummaryDto } from "@ufc-intelligence/types";

const SAMPLE_SLUG = "ilia-topuria";

function opponentOf(fight: FightSummaryDto, fighterId: string) {
  return fight.fighterA.id === fighterId ? fight.fighterB : fight.fighterA;
}

function formatFightDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// DESIGN SANDBOX - visual prototype only, real data (same fighter used
// throughout this session's real API calls), no production file touched.
export default async function FighterProfileSandbox() {
  const fighter = await api.fighters.getBySlug(SAMPLE_SLUG).catch(() => null);

  if (!fighter) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <p className="text-body-md text-text-muted">Couldn&apos;t load sample fighter data.</p>
      </main>
    );
  }

  const record = `${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}`;

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
      <SandboxBanner
        title="Fighter profile"
        liveHref={`/fighters/${SAMPLE_SLUG}`}
        liveLabel="the live fighter profile"
        applied={[
          "Elo/rank/fights: one flat stat strip with dividers, not a separately-bordered box (finding #6)",
          "Performance tags: a plain flowing list instead of 5 individual pill badges (finding #5)",
          "Stat grid: values sized up relative to labels, not just gold-colored (finding #9)",
          "Gold restrained to rank badge, Elo number, and the winning method — not every link/hover (finding #2)",
          "Header photo: octagon.jpg at raised opacity (\"option B\") — the live profile page has no photo header today, this is a new addition to test",
        ]}
      />

      <div className="mt-8">
        <PhotoHeader src="/images/octagon.jpg" focalPosition="50% 40%" title={fighter.name} description={fighter.weightClass?.name} />
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[300px_1fr]">
        <div>
          <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-bg-elevated">
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
            <h1 className="font-display text-display-md text-text-primary">{fighter.name}</h1>
            {fighter.rank !== null && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-300 font-display text-sm font-medium text-text-on-gold">
                {fighter.rank === 0 ? "C" : fighter.rank}
              </span>
            )}
          </div>
          <p className="mt-1 text-body-md text-text-secondary">
            {record} {fighter.weightClass ? `· ${fighter.weightClass.name}` : ""}
          </p>

          {/* Flat stat strip, replacing the separately-bordered Elo box */}
          <div className="mt-4 flex divide-x divide-border border-y border-border py-4">
            {fighter.elo !== null && (
              <div className="flex-1 pr-6">
                <p className="text-caption text-text-secondary">Elo rating</p>
                <p className="mt-1 font-display text-heading-lg tabular-nums text-gold-300">
                  {Math.round(fighter.elo)}
                </p>
              </div>
            )}
            {fighter.eloRank !== null && (
              <div className="flex-1 px-6">
                <p className="text-caption text-text-secondary">Elo rank</p>
                <p className="mt-1 font-display text-heading-lg tabular-nums text-text-primary">
                  #{fighter.eloRank}
                </p>
              </div>
            )}
            <div className="flex-1 pl-6">
              <p className="text-caption text-text-secondary">Fights</p>
              <p className="mt-1 font-display text-heading-lg tabular-nums text-text-primary">
                {fighter.eloFightCount}
              </p>
            </div>
          </div>

          {/* Performance tags - plain flowing text instead of pill badges */}
          {fighter.performanceProfile.length > 0 && (
            <div className="mt-5">
              <p className="text-caption font-medium uppercase tracking-wide text-text-secondary">
                Performance profile
              </p>
              <p className="mt-2 text-body-md text-text-primary">
                {fighter.performanceProfile.map((t) => t.label).join("  ·  ")}
              </p>
            </div>
          )}

          {/* Career stat grid - values sized up, labels stay small/muted */}
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <ProposedStat label="Sig. strike accuracy" value={fmtPct(fighter.careerStats.sigStrikeAccuracyPct)} />
            <ProposedStat label="Strikes landed / min" value={fmtRate(fighter.careerStats.sigStrikesLandedPerMin)} />
            <ProposedStat label="Takedown avg / 15 min" value={fmtRate(fighter.careerStats.takedownAvgPer15Min)} />
            <ProposedStat label="Takedown defense" value={fmtPct(fighter.careerStats.takedownDefensePct)} />
            <ProposedStat label="Height" value={fighter.heightCm ? `${fighter.heightCm} cm` : "—"} />
            <ProposedStat label="Reach" value={fighter.reachCm ? `${fighter.reachCm} cm` : "—"} />
            <ProposedStat label="Nationality" value={fighter.nationality ?? "—"} />
            <ProposedStat
              label="Submission avg / 15 min"
              value={fmtRate(fighter.careerStats.submissionAvgPer15Min)}
            />
          </div>

          {fighter.eloHistory.length >= 2 && (
            <div className="mt-10">
              <h2 className="font-display text-heading-md text-text-primary">Elo history</h2>
              <div className="mt-4 border-t border-border pt-4">
                <EloHistoryChart history={fighter.eloHistory} />
              </div>
            </div>
          )}

          {fighter.percentileProfile && (
            <div className="mt-10">
              <h2 className="font-display text-heading-md text-text-primary">Performance profile</h2>
              <div className="mt-4 border-t border-border pt-4">
                <FighterRadarChart fighterName={fighter.name} percentiles={fighter.percentileProfile} />
              </div>
            </div>
          )}

          <div className="mt-10">
            <h2 className="font-display text-heading-md text-text-primary">Win method breakdown</h2>
            <div className="mt-4 border-t border-border pt-4">
              <MethodBreakdownChart
                koTko={fighter.careerStats.koTkoWins}
                submission={fighter.careerStats.submissionWins}
                decision={fighter.careerStats.decisionWins}
              />
            </div>
          </div>

          <div className="mt-10">
            <h2 className="font-display text-heading-md text-text-primary">Recent fights</h2>
            <div className="mt-4 divide-y divide-border border-t border-border">
              {fighter.recentFights.slice(0, 5).map((fight) => {
                const opponent = opponentOf(fight, fighter.id);
                const won = fight.winnerId === fighter.id;
                return (
                  <div key={fight.id} className="flex items-center justify-between py-3.5">
                    <span className={`text-body-md ${won ? "font-medium text-gold-300" : "text-text-primary"}`}>
                      {won ? "W" : fight.winnerId ? "L" : "—"} vs {opponent.name}
                    </span>
                    <span className="text-right text-xs text-text-secondary">
                      {METHOD_LABEL[fight.method] ?? fight.method}
                      <br />
                      {formatFightDate(fight.event.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function fmtPct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}
function fmtRate(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function ProposedStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-heading-md font-medium tabular-nums text-text-primary">
        {value}
      </p>
    </div>
  );
}
