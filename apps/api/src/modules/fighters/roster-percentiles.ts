import { prisma } from "@ufc-intelligence/database";
import type { StatPercentiles } from "@ufc-intelligence/types";

export interface FighterPercentileProfile extends StatPercentiles {
  completedFightsCount: number;
  // Percentile rank of this fighter's total completed-fight count among
  // the same rated population - not part of the shipped StatPercentiles
  // DTO (that type only covers the radar-chart's 12 stats), kept local to
  // this module until the "Highly Experienced" tag actually ships.
  fightCountPercentile: number | null;
}

const METRIC_KEYS = [
  "elo",
  "strikeAccuracy",
  "takedownAccuracy",
  "takedownDefense",
  "finishRate",
  "winRate",
  "strikesLandedPerMin",
  "takedownAvg",
  "submissionAvg",
  "koRate",
  "submissionRate",
  "decisionRate",
] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

// Roster-wide percentile engine for every rated fighter (eloRating IS NOT
// NULL - same population FightersService.getComparePercentiles already
// uses for the Compare page radar chart). Deliberately duplicated here
// rather than importing from fighters.service.ts: this is exploratory,
// not-yet-shipped work for the Performance Profile feature, and keeping it
// separate means it can't accidentally change behavior on the
// already-shipped compare-percentiles endpoint. If/when the profile
// feature actually ships, fighters.service.ts should be refactored to call
// this shared engine instead of keeping its own copy of the same query.
export async function computeRosterPercentiles(): Promise<Map<string, FighterPercentileProfile>> {
  const rated = await prisma.fighter.findMany({
    where: { eloRating: { not: null } },
    select: {
      id: true,
      eloRating: true,
      sigStrikeAccuracyPct: true,
      takedownAccuracyPct: true,
      takedownDefensePct: true,
      sigStrikesLandedPerMin: true,
      takedownAvgPer15Min: true,
      submissionAvgPer15Min: true,
      wins: true,
      losses: true,
    },
  });
  const ratedIds = new Set(rated.map((f) => f.id));

  const decidedFights = await prisma.fight.findMany({
    where: { status: "COMPLETED", winnerId: { not: null } },
    select: { winnerId: true, method: true },
  });
  const koWins = new Map<string, number>();
  const subWins = new Map<string, number>();
  const decWins = new Map<string, number>();
  for (const fight of decidedFights) {
    const winnerId = fight.winnerId!;
    if (!ratedIds.has(winnerId)) continue;
    if (fight.method === "KO" || fight.method === "TKO") {
      koWins.set(winnerId, (koWins.get(winnerId) ?? 0) + 1);
    } else if (fight.method === "SUBMISSION") {
      subWins.set(winnerId, (subWins.get(winnerId) ?? 0) + 1);
    } else if (fight.method.startsWith("DECISION")) {
      decWins.set(winnerId, (decWins.get(winnerId) ?? 0) + 1);
    }
  }

  // Total completed fights per fighter (either corner) - a separate tally
  // from decidedFights above, since a fighter's career fight count
  // includes draws/no-contests that decidedFights deliberately excludes.
  const allCompleted = await prisma.fight.findMany({
    where: { status: "COMPLETED" },
    select: { fighterAId: true, fighterBId: true },
  });
  const fightCounts = new Map<string, number>();
  for (const f of allCompleted) {
    if (ratedIds.has(f.fighterAId)) {
      fightCounts.set(f.fighterAId, (fightCounts.get(f.fighterAId) ?? 0) + 1);
    }
    if (ratedIds.has(f.fighterBId)) {
      fightCounts.set(f.fighterBId, (fightCounts.get(f.fighterBId) ?? 0) + 1);
    }
  }

  type Metrics = Record<MetricKey, number | null> & { fightCount: number };
  const metricsById = new Map<string, Metrics>();
  for (const f of rated) {
    const ko = koWins.get(f.id) ?? 0;
    const sub = subWins.get(f.id) ?? 0;
    const dec = decWins.get(f.id) ?? 0;
    const totalDecided = ko + sub + dec;
    metricsById.set(f.id, {
      elo: f.eloRating,
      strikeAccuracy: f.sigStrikeAccuracyPct,
      takedownAccuracy: f.takedownAccuracyPct,
      takedownDefense: f.takedownDefensePct,
      strikesLandedPerMin: f.sigStrikesLandedPerMin,
      takedownAvg: f.takedownAvgPer15Min,
      submissionAvg: f.submissionAvgPer15Min,
      winRate: f.wins + f.losses > 0 ? (f.wins / (f.wins + f.losses)) * 100 : null,
      finishRate: totalDecided > 0 ? ((ko + sub) / totalDecided) * 100 : null,
      koRate: totalDecided > 0 ? (ko / totalDecided) * 100 : null,
      submissionRate: totalDecided > 0 ? (sub / totalDecided) * 100 : null,
      decisionRate: totalDecided > 0 ? (dec / totalDecided) * 100 : null,
      fightCount: fightCounts.get(f.id) ?? 0,
    });
  }

  const sortedValues = new Map<MetricKey, number[]>();
  for (const key of METRIC_KEYS) {
    sortedValues.set(
      key,
      [...metricsById.values()]
        .map((m) => m[key])
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b),
    );
  }
  const sortedFightCounts = [...metricsById.values()].map((m) => m.fightCount).sort((a, b) => a - b);

  function percentileOf(values: number[], value: number | null): number | null {
    if (value === null || values.length === 0) return null;
    let lower = 0;
    for (const v of values) {
      if (v < value) lower++;
    }
    return Math.round((lower / values.length) * 100);
  }

  const result = new Map<string, FighterPercentileProfile>();
  for (const [id, m] of metricsById) {
    const profile = {} as FighterPercentileProfile;
    for (const key of METRIC_KEYS) {
      profile[key] = percentileOf(sortedValues.get(key)!, m[key]);
    }
    profile.completedFightsCount = m.fightCount;
    profile.fightCountPercentile = percentileOf(sortedFightCounts, m.fightCount);
    result.set(id, profile);
  }
  return result;
}
