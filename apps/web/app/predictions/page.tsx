"use client";

import { useState } from "react";
import { FighterSearchInput } from "@/components/ui/fighter-search-input";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
import { PageAtmosphere } from "@/components/ui/page-atmosphere";
import { api, ApiError } from "@/lib/api-client";
import type { FighterSummaryDto, PredictionDto } from "@ufc-intelligence/types";

// undefined = unknown weight class, don't restrict on it
function genderOf(fighter: FighterSummaryDto): "men" | "women" | undefined {
  return fighter.weightClass ? (fighter.weightClass.isWomens ? "women" : "men") : undefined;
}

export default function PredictionsPage() {
  const [fighterA, setFighterA] = useState<FighterSummaryDto | null>(null);
  const [fighterB, setFighterB] = useState<FighterSummaryDto | null>(null);
  const [prediction, setPrediction] = useState<PredictionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickA(fighter: FighterSummaryDto) {
    setFighterA(fighter);
    // Clear B if it's now a cross-gender matchup — a fresh A pick takes
    // priority over a stale B pick from a different division.
    if (fighterB && genderOf(fighter) && genderOf(fighterB) && genderOf(fighter) !== genderOf(fighterB)) {
      setFighterB(null);
    }
  }

  async function handlePredict() {
    if (!fighterA || !fighterB) return;
    setLoading(true);
    setError(null);
    setPrediction(null);
    try {
      const result = await api.predictions.getMatchup(fighterA.slug, fighterB.slug);
      setPrediction(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? e.message
          : "Couldn't generate a prediction for that matchup.",
      );
    } finally {
      setLoading(false);
    }
  }

  const pctA = prediction ? Math.round(prediction.winnerProbabilityA * 100) : 50;
  const pctB = prediction ? Math.round(prediction.winnerProbabilityB * 100) : 50;

  return (
    <>
      <PageAtmosphere src="/images/conor-mcgregor.jpg" alt="" focalPosition="50% 15%" />
      <main className="mx-auto max-w-[760px] px-4 py-12 md:px-8">
      <div className="rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
        <h1 className="font-display text-heading-lg text-text-primary">
          Fantasy Matchup Predictor
        </h1>
        <p className="mt-2 text-body-md text-text-secondary">
          Pick any two fighters for an explainable win-probability breakdown, built from real career stats.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <FighterSearchInput label="Fighter A" onSelect={pickA} genderFilter={fighterB ? genderOf(fighterB) : undefined} />
          <FighterSearchInput label="Fighter B" onSelect={setFighterB} genderFilter={fighterA ? genderOf(fighterA) : undefined} />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Fighters are matched within the same gender division.
        </p>

        <button
          onClick={handlePredict}
          disabled={!fighterA || !fighterB || loading}
          className="mt-6 w-full rounded-md bg-gold-300 py-2.5 text-body-md font-medium text-text-on-gold transition-standard hover:bg-gold-100 disabled:opacity-40"
        >
          {loading ? "Analyzing..." : "Predict this fight"}
        </button>

        {error && <p className="mt-4 text-xs text-danger">{error}</p>}
      </div>

      {fighterA && fighterB && (
        <div className="mt-10 rounded-lg border border-glass bg-glass p-6 backdrop-blur-2xl backdrop-saturate-150 shadow-glass">
          {/* Fighter vs fighter header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col items-center gap-3">
              <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border-strong">
                <FighterAvatar name={fighterA.name} photoUrl={fighterA.photoUrl} />
              </div>
              <p className="text-center font-display text-body-lg font-medium text-text-primary">
                {fighterA.name}
              </p>
              {prediction && (
                <p className="font-display text-3xl font-medium text-gold-300">{pctA}%</p>
              )}
            </div>

            <span className="font-display text-heading-md text-text-muted">VS</span>

            <div className="flex flex-1 flex-col items-center gap-3">
              <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border-strong">
                <FighterAvatar name={fighterB.name} photoUrl={fighterB.photoUrl} />
              </div>
              <p className="text-center font-display text-body-lg font-medium text-text-primary">
                {fighterB.name}
              </p>
              {prediction && (
                <p className="font-display text-3xl font-medium text-gold-300">{pctB}%</p>
              )}
            </div>
          </div>

          {prediction && (
            <>
              <div className="mt-6 flex h-2 w-full overflow-hidden rounded-full bg-bg-elevated-2">
                <div className="h-full bg-gold-300" style={{ width: `${pctA}%` }} />
                <div className="h-full bg-border-strong" style={{ width: `${pctB}%` }} />
              </div>

              <p className="mt-3 text-center text-xs text-text-muted">
                Model confidence: {Math.round(prediction.confidenceScore * 100)}%
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <MethodStat label="KO/TKO" value={prediction.koProbability} />
                <MethodStat label="Submission" value={prediction.subProbability} />
                <MethodStat label="Decision" value={prediction.decisionProbability} />
              </div>

              <div className="mt-6 border-t border-border pt-6">
                <p className="text-caption text-text-secondary">Key factors</p>
                <div className="mt-3 flex flex-col gap-3">
                  {prediction.topFactors.length === 0 && (
                    <p className="text-body-md text-text-muted">
                      Not enough recorded data to identify a clear edge between these two fighters.
                    </p>
                  )}
                  {prediction.topFactors.map((factor) => (
                    <div
                      key={factor.factor}
                      className="rounded-md border border-border bg-bg-elevated-2 px-3 py-2"
                    >
                      <p className="text-body-md text-text-primary">{factor.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      </main>
    </>
  );
}

function MethodStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-bg-elevated-2 p-3">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-lg font-medium text-text-primary">
        {Math.round(value * 100)}%
      </p>
    </div>
  );
}