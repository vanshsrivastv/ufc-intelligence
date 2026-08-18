import { api } from "@/lib/api-client";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { SandboxBanner } from "../_components/sandbox-banner";
import { PhotoHeader } from "../_components/photo-header";

const SLUG_A = "ilia-topuria";
const SLUG_B = "justin-gaethje";

// DESIGN SANDBOX - visual prototype only, real matchup prediction data.
export default async function PredictionsSandbox() {
  const [fighterA, fighterB] = await Promise.all([
    api.fighters.getBySlug(SLUG_A).catch(() => null),
    api.fighters.getBySlug(SLUG_B).catch(() => null),
  ]);
  const prediction =
    fighterA && fighterB ? await api.predictions.getMatchup(SLUG_A, SLUG_B).catch(() => null) : null;

  if (!fighterA || !fighterB || !prediction) {
    return (
      <main className="mx-auto max-w-[760px] px-4 py-10 md:px-8">
        <p className="text-body-md text-text-muted">Couldn&apos;t load sample prediction data.</p>
      </main>
    );
  }

  const pctA = Math.round(prediction.winnerProbabilityA * 100);
  const pctB = Math.round(prediction.winnerProbabilityB * 100);

  return (
    <main className="mx-auto max-w-[760px] px-4 py-10 md:px-8">
      <SandboxBanner
        title="Predictions"
        liveHref="/predictions"
        liveLabel="the live Predictions page"
        applied={[
          "Header + result card: flat surfaces, no glass/blur (finding #1)",
          "KO/Submission/Decision cells: one flat row with dividers instead of 3 bordered boxes (finding #6)",
          "Key factors: a plain list with a thin gold rule for the leading factor, not a bordered card per row (finding #5, #6)",
        ]}
      />

      <div className="mt-8">
        <PhotoHeader
          src="/images/conor-mcgregor.jpg"
          focalPosition="50% 15%"
          title="Fantasy Matchup Predictor"
          description="Pick any two fighters for an explainable win-probability breakdown, built from real career stats."
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-bg-elevated p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 flex-col items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-border-strong">
              <FighterAvatar name={fighterA.name} photoUrl={fighterA.photoUrl} />
            </div>
            <p className="text-center font-display text-body-lg font-medium text-text-primary">{fighterA.name}</p>
            <p className="font-display text-3xl font-medium text-gold-300">{pctA}%</p>
          </div>
          <span className="font-display text-heading-md text-text-muted">VS</span>
          <div className="flex flex-1 flex-col items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-border-strong">
              <FighterAvatar name={fighterB.name} photoUrl={fighterB.photoUrl} />
            </div>
            <p className="text-center font-display text-body-lg font-medium text-text-primary">{fighterB.name}</p>
            <p className="font-display text-3xl font-medium text-gold-300">{pctB}%</p>
          </div>
        </div>

        <div className="mt-6 flex h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated-2">
          <div className="h-full bg-gold-300" style={{ width: `${pctA}%` }} />
          <div className="h-full bg-border-strong" style={{ width: `${pctB}%` }} />
        </div>
        <p className="mt-3 text-center text-xs text-text-muted">
          Model confidence: {Math.round(prediction.confidenceScore * 100)}%
        </p>

        <div className="mt-6 flex divide-x divide-border border-y border-border py-4 text-center">
          <MethodCell label="KO/TKO" value={prediction.koProbability} />
          <MethodCell label="Submission" value={prediction.subProbability} />
          <MethodCell label="Decision" value={prediction.decisionProbability} />
        </div>

        <div className="mt-6">
          <p className="text-caption text-text-secondary">Key factors</p>
          <div className="mt-3 divide-y divide-border">
            {prediction.topFactors.length === 0 && (
              <p className="py-3 text-body-md text-text-muted">
                Not enough recorded data to identify a clear edge between these two fighters.
              </p>
            )}
            {prediction.topFactors.map((factor) => (
              <div key={factor.factor} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-body-md text-text-primary">{factor.explanation}</p>
                  <span className="shrink-0 text-[11px] text-text-secondary">
                    Favors{" "}
                    <span className="font-medium text-gold-300">
                      {factor.favors === "A" ? fighterA.name : fighterB.name}
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-bg-elevated-2">
                  <div
                    className="h-full bg-gold-300"
                    style={{ width: `${Math.round(factor.weight * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-text-muted">Model {prediction.modelVersion}</p>
      </div>
    </main>
  );
}

function MethodCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 px-3 first:pl-0 last:pr-0">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-lg font-medium text-text-primary">
        {Math.round(value * 100)}%
      </p>
    </div>
  );
}
