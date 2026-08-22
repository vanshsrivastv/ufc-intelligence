import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { api } from "@/lib/api-client";
import { CompareFaceOff } from "@/components/ui/compare-faceoff";
import { EmptyState } from "@/components/ui/empty-state";
import { METHOD_LABEL } from "@/lib/method-label";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const fight = await api.fights.getById(id).catch(() => null);
  if (!fight) return { title: "Fight not found" };

  const title = `${fight.fighterA.name} vs ${fight.fighterB.name} — ${fight.event.name}`;
  const description =
    fight.status === "COMPLETED"
      ? `${fight.fighterA.name} vs ${fight.fighterB.name} at ${fight.event.name}. Result: ${
          METHOD_LABEL[fight.method] ?? fight.method
        }${fight.round ? ` (Round ${fight.round})` : ""}.`
      : `${fight.fighterA.name} vs ${fight.fighterB.name} at ${fight.event.name}. Full stats, breakdown, and win-probability prediction on UFC Intelligence.`;

  return { title, description, openGraph: { title, description } };
}

export default async function FightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fight = await api.fights.getById(id).catch(() => null);

  if (!fight) {
    notFound();
  }

  const [fighterA, fighterB] = await Promise.all([
    api.fighters.getBySlug(fight.fighterA.slug).catch(() => null),
    api.fighters.getBySlug(fight.fighterB.slug).catch(() => null),
  ]);

  const isDecided = fight.status === "COMPLETED";
  const prediction =
    !isDecided && fighterA && fighterB
      ? await api.predictions.getMatchup(fight.fighterA.slug, fight.fighterB.slug).catch(() => null)
      : null;

  const totalsA = fight.stats.find((s) => s.round === 0 && s.fighterId === fight.fighterA.id);
  const totalsB = fight.stats.find((s) => s.round === 0 && s.fighterId === fight.fighterB.id);

  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <Link
        href={`/events/${fight.event.slug}`}
        className="text-xs text-text-secondary transition-standard hover:text-gold-300"
      >
        ← {fight.event.name}
      </Link>

      <div className="mt-3 flex items-center gap-2">
        {fight.isTitleFight && (
          <span className="rounded-sm bg-gold-900 px-2 py-0.5 text-[10px] font-medium text-gold-300">
            Title Fight
          </span>
        )}
        {fight.weightClass && (
          <span className="text-[11px] text-text-secondary">{fight.weightClass.name}</span>
        )}
        <span className="text-[11px] text-text-muted">
          {isDecided ? METHOD_LABEL[fight.method] ?? fight.method : fight.status}
          {isDecided && fight.round ? ` · R${fight.round}${fight.time ? ` ${fight.time}` : ""}` : ""}
        </span>
      </div>

      {fighterA && fighterB ? (
        <div className="mt-6">
          <CompareFaceOff
            fighterA={fighterA}
            fighterB={fighterB}
            asOfA={fight.fighterAAtFightTime}
            asOfB={fight.fighterBAtFightTime}
            flat
          />
        </div>
      ) : (
        <EmptyState message="Couldn't load one or both fighters for this fight." />
      )}

      {!isDecided && prediction && (
        <div className="mt-8 rounded-lg border border-border bg-bg-elevated p-6">
          <p className="font-display text-heading-md text-text-primary">Prediction</p>
          <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-bg-elevated-2">
            <div
              className="h-full bg-gold-300"
              style={{ width: `${Math.round(prediction.winnerProbabilityA * 100)}%` }}
            />
            <div
              className="h-full bg-border-strong"
              style={{ width: `${Math.round(prediction.winnerProbabilityB * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm tabular-nums">
            <span className="text-gold-300">
              {Math.round(prediction.winnerProbabilityA * 100)}%
            </span>
            <span className="text-text-secondary">
              {Math.round(prediction.winnerProbabilityB * 100)}%
            </span>
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Model confidence: {Math.round(prediction.confidenceScore * 100)}%
          </p>

          {prediction.topFactors.length > 0 && (
            <div className="mt-5 divide-y divide-border border-t border-border">
              {prediction.topFactors.map((factor) => (
                <p key={factor.factor} className="py-2.5 text-body-md text-text-primary">
                  {factor.explanation}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {isDecided && totalsA && totalsB && (
        <div className="mt-8 rounded-lg border border-border bg-bg-elevated p-6">
          <p className="mb-4 font-display text-heading-md text-text-primary">Fight Statistics</p>
          <StatLine label="Significant strikes landed" a={totalsA.sigStrikesLanded} b={totalsB.sigStrikesLanded} />
          <StatLine label="Significant strikes attempted" a={totalsA.sigStrikesAttempted} b={totalsB.sigStrikesAttempted} />
          <StatLine label="Takedowns landed" a={totalsA.takedownsLanded} b={totalsB.takedownsLanded} />
          <StatLine label="Takedowns attempted" a={totalsA.takedownsAttempted} b={totalsB.takedownsAttempted} />
          <StatLine label="Control time (sec)" a={totalsA.controlTimeSeconds} b={totalsB.controlTimeSeconds} />
          <StatLine label="Knockdowns" a={totalsA.knockdowns} b={totalsB.knockdowns} last />
        </div>
      )}

      <div className="mt-8 rounded-lg border border-border bg-bg-elevated p-6">
        <p className="mb-3 font-display text-heading-md text-text-primary">Previous Meetings</p>
        {fight.previousMeetings.length === 0 ? (
          <p className="text-body-md text-text-muted">First meeting between these two fighters.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {fight.previousMeetings.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 text-body-md">
                <span className="text-text-primary">{m.eventName}</span>
                <span className="text-xs text-text-secondary">
                  {new Date(m.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  · {METHOD_LABEL[m.method] ?? m.method}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatLine({
  label,
  a,
  b,
  last = false,
}: {
  label: string;
  a: number;
  b: number;
  last?: boolean;
}) {
  const total = a + b;
  const pctA = total > 0 ? (a / total) * 100 : 50;

  return (
    <div className={`py-2.5 ${last ? "" : "border-b border-border"}`}>
      <p className="mb-1.5 text-center text-[11px] uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-bg-elevated-2">
        <div className="h-full bg-gold-300" style={{ width: `${pctA}%` }} />
        <div className="h-full bg-text-secondary" style={{ width: `${100 - pctA}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-sm tabular-nums text-text-secondary">
        <span>{a}</span>
        <span>{b}</span>
      </div>
    </div>
  );
}
