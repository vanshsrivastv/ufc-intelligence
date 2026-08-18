"use client";

import { useState } from "react";
import { FighterSearchInput } from "@/components/ui/fighter-search-input";
import { FighterAvatar } from "@/components/ui/fighter-avatar";
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
    <main className="mx-auto max-w-[760px] px-4 py-12 md:px-8">
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

      {fighterA && fighterB && (
        <div className="mt-10 rounded-lg border border-border bg-bg-elevated p-6">
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

              <div className="mt-6 flex divide-x divide-border border-y border-border py-4 text-center">
                <MethodStat label="KO/TKO" value={prediction.koProbability} />
                <MethodStat label="Submission" value={prediction.subProbability} />
                <MethodStat label="Decision" value={prediction.decisionProbability} />
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

              <p className="mt-6 text-center text-[11px] text-text-muted">
                Model {prediction.modelVersion}
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function MethodStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 px-3 first:pl-0 last:pr-0">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 font-display text-lg font-medium text-text-primary">
        {Math.round(value * 100)}%
      </p>
    </div>
  );
}