import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Fight, FightMethod, prisma } from "@ufc-intelligence/database";
import type { PredictionDto, PredictionFactor } from "@ufc-intelligence/types";
import {
  BASE_NUMERIC_FEATURES,
  BaseNumericFeature,
  evaluateMatchup,
  FeatureDiffs,
  loadPredictionModel,
} from "./prediction-model";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const KO_METHODS: FightMethod[] = ["KO", "TKO"];
const DECISION_METHODS: FightMethod[] = ["DECISION_UNANIMOUS", "DECISION_SPLIT", "DECISION_MAJORITY"];

// Mirrors ml/scripts/build_features.py's WEIGHT_CLASS_KEYWORDS /
// normalize_weight_class exactly, so a live fighter's weight class maps
// onto the same category the model was trained on. "light heavyweight"
// is checked before "heavyweight" so it isn't matched as a substring of
// the wrong keyword.
const WEIGHT_CLASS_KEYWORDS = [
  "light heavyweight",
  "strawweight",
  "flyweight",
  "bantamweight",
  "featherweight",
  "lightweight",
  "welterweight",
  "middleweight",
  "heavyweight",
  "catch weight",
];

function normalizeWeightClass(raw: string | null): string {
  if (!raw) return "open_weight";
  const lowered = raw.toLowerCase();
  for (const keyword of WEIGHT_CLASS_KEYWORDS) {
    if (lowered.includes(keyword)) return keyword.replace(/ /g, "_");
  }
  return "open_weight";
}

// Mirrors build_features.py's stance_matchup exactly.
function stanceMatchup(stanceA: string | null, stanceB: string | null): string {
  if (!stanceA || !stanceB) return "unknown";
  const [first, second] = [stanceA.toLowerCase(), stanceB.toLowerCase()].sort();
  return `${first}_vs_${second}`;
}

function parseFightTimeSeconds(round: number | null, time: string | null): number | null {
  if (!round || !time) return null;
  const match = time.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  const minutesInFinishingRound = Number(match[1]) * 60 + Number(match[2]);
  return (round - 1) * 300 + minutesInFinishingRound; // UFC rounds are 5 minutes each
}

function methodBucket(method: FightMethod): "ko" | "sub" | "decision" | "other" {
  if (KO_METHODS.includes(method)) return "ko";
  if (method === "SUBMISSION") return "sub";
  if (DECISION_METHODS.includes(method)) return "decision";
  return "other";
}

interface FighterModelInputs {
  id: string;
  slug: string;
  name: string;
  eloRating: number;
  totalFights: number;
  winRate: number;
  recentFormRate: number | null;
  strikeAccuracy: number | null;
  takedownAccuracy: number | null;
  koRate: number;
  subRate: number;
  decisionRate: number;
  finishRate: number;
  avgFightDurationSec: number | null;
  heightCm: number | null;
  reachCm: number | null;
  ageYears: number | null;
  stance: string | null;
  weightClassRaw: string | null;
}

@Injectable()
export class PredictionsService {
  async getMatchup(fighterASlug: string, fighterBSlug: string): Promise<PredictionDto> {
    await this.assertSameGender(fighterASlug, fighterBSlug);

    const model = loadPredictionModel();
    const recentFormMinFights = model.recentFormMinFights;

    const [a, b] = await Promise.all([
      this.buildFeatures(fighterASlug, recentFormMinFights),
      this.buildFeatures(fighterBSlug, recentFormMinFights),
    ]);

    const diffs = this.buildDiffs(a, b);
    const categoricalValues = {
      weight_class: normalizeWeightClass(a.weightClassRaw ?? b.weightClassRaw),
      stance_matchup: stanceMatchup(a.stance, b.stance),
    };

    const { probabilityA, contributions } = evaluateMatchup(diffs, categoricalValues, model);
    const winnerProbabilityA = round(probabilityA);
    const winnerProbabilityB = round(1 - probabilityA);

    const { koProbability, subProbability, decisionProbability } = this.buildMethodProbabilities(a, b);
    const confidenceScore = round(this.buildConfidence(a, b, model.missingIndicatorFeatures));
    const topFactors = this.buildFactors(a, b, contributions);

    return {
      fightId: `matchup-${a.id}-${b.id}`,
      modelVersion: model.modelVersion,
      winnerProbabilityA,
      winnerProbabilityB,
      koProbability: round(koProbability),
      subProbability: round(subProbability),
      decisionProbability: round(decisionProbability),
      confidenceScore,
      topFactors,
      generatedAt: new Date().toISOString(),
    };
  }

  private async assertSameGender(slugA: string, slugB: string): Promise<void> {
    const [a, b] = await Promise.all([
      prisma.fighter.findUnique({
        where: { slug: slugA },
        select: { weightClass: { select: { isWomens: true } } },
      }),
      prisma.fighter.findUnique({
        where: { slug: slugB },
        select: { weightClass: { select: { isWomens: true } } },
      }),
    ]);
    if (!a) throw new NotFoundException(`Fighter with slug "${slugA}" not found`);
    if (!b) throw new NotFoundException(`Fighter with slug "${slugB}" not found`);

    const genderA = a.weightClass?.isWomens ?? null;
    const genderB = b.weightClass?.isWomens ?? null;
    // null = unknown division, don't block on it — only reject when both
    // are known and actually differ.
    if (genderA !== null && genderB !== null && genderA !== genderB) {
      throw new BadRequestException(
        "Predictions must compare fighters in the same gender division.",
      );
    }
  }

  private async buildFeatures(slug: string, recentFormMinFights: number): Promise<FighterModelInputs> {
    const fighter = await prisma.fighter.findUnique({
      where: { slug },
      include: {
        weightClass: true,
        fightsAsA: { include: { event: { select: { date: true } } } },
        fightsAsB: { include: { event: { select: { date: true } } } },
      },
    });
    if (!fighter) throw new NotFoundException(`Fighter with slug "${slug}" not found`);

    const allFights = [...fighter.fightsAsA, ...fighter.fightsAsB].filter(
      (f) => f.status === "COMPLETED",
    );
    const totalFights = allFights.length;
    const wins = allFights.filter((f) => f.winnerId === fighter.id);
    const winRate = totalFights > 0 ? wins.length / totalFights : 0.5;

    // "Recent form" is only a distinct signal from career win rate once
    // the last-N window is a genuine subset of career history - matches
    // build_features.py's recent_form() exactly (see that file's comment
    // for why: for a fighter with <= recentFormMinFights fights, "last N"
    // and "career win rate" are literally the same number).
    const recentFormRate =
      totalFights <= recentFormMinFights
        ? null
        : this.recentFormRate(allFights, fighter.id, recentFormMinFights);

    const koWins = wins.filter((f) => methodBucket(f.method) === "ko").length;
    const subWins = wins.filter((f) => methodBucket(f.method) === "sub").length;
    const decisionWins = wins.filter((f) => methodBucket(f.method) === "decision").length;
    const koRate = wins.length > 0 ? koWins / wins.length : 0;
    const subRate = wins.length > 0 ? subWins / wins.length : 0;
    const decisionRate = wins.length > 0 ? decisionWins / wins.length : 0;
    const finishRate = wins.length > 0 ? (koWins + subWins) / wins.length : 0;

    const durations = allFights
      .map((f) => parseFightTimeSeconds(f.round, f.time))
      .filter((d): d is number => d !== null);
    const avgFightDurationSec = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : null;

    const stats = await prisma.fightStat.findMany({
      where: { fighterId: fighter.id, round: 0 },
    });
    const strikesAttempted = stats.reduce((s, r) => s + r.sigStrikesAttempted, 0);
    const strikeAccuracy =
      strikesAttempted > 0
        ? stats.reduce((s, r) => s + r.sigStrikesLanded, 0) / strikesAttempted
        : null;

    const tdAttempted = stats.reduce((s, r) => s + r.takedownsAttempted, 0);
    const takedownAccuracy =
      tdAttempted > 0 ? stats.reduce((s, r) => s + r.takedownsLanded, 0) / tdAttempted : null;

    const ageYears = fighter.dob ? (Date.now() - fighter.dob.getTime()) / MS_PER_YEAR : null;

    return {
      id: fighter.id,
      slug: fighter.slug,
      name: fighter.name,
      eloRating: fighter.eloRating,
      totalFights,
      winRate,
      recentFormRate,
      strikeAccuracy,
      takedownAccuracy,
      koRate,
      subRate,
      decisionRate,
      finishRate,
      avgFightDurationSec,
      heightCm: fighter.heightCm,
      reachCm: fighter.reachCm,
      ageYears,
      stance: fighter.stance,
      weightClassRaw: fighter.weightClass?.name ?? null,
    };
  }

  private recentFormRate(
    fights: (Fight & { event: { date: Date } })[],
    fighterId: string,
    windowSize: number,
  ): number {
    const recent = fights
      .slice()
      .sort((x, y) => y.event.date.getTime() - x.event.date.getTime())
      .slice(0, windowSize);
    return recent.filter((f) => f.winnerId === fighterId).length / recent.length;
  }

  // Every entry here is either a real diff or null - null is the only
  // signal evaluateMatchup needs to know a feature is missing (matches
  // build_features.py's NaN-then-fillna(0)-plus-flag pattern).
  private buildDiffs(a: FighterModelInputs, b: FighterModelInputs): FeatureDiffs {
    const diff = (x: number | null, y: number | null) => (x === null || y === null ? null : x - y);
    const diffs: Record<BaseNumericFeature, number | null> = {
      elo_diff: a.eloRating - b.eloRating,
      experience_diff: a.totalFights - b.totalFights,
      win_rate_diff: a.winRate - b.winRate,
      recent_form_diff: diff(a.recentFormRate, b.recentFormRate),
      strike_accuracy_diff: diff(a.strikeAccuracy, b.strikeAccuracy),
      takedown_accuracy_diff: diff(a.takedownAccuracy, b.takedownAccuracy),
      ko_rate_diff: a.koRate - b.koRate,
      sub_rate_diff: a.subRate - b.subRate,
      decision_rate_diff: a.decisionRate - b.decisionRate,
      finish_rate_diff: a.finishRate - b.finishRate,
      avg_fight_duration_diff: diff(a.avgFightDurationSec, b.avgFightDurationSec),
      height_diff_cm: diff(a.heightCm, b.heightCm),
      reach_diff_cm: diff(a.reachCm, b.reachCm),
      age_diff_years: diff(a.ageYears, b.ageYears),
    };
    // Sanity check that this object really does have every feature the
    // model expects - cheaper to fail loudly here than to silently treat
    // a typo'd key as "missing" forever.
    for (const key of BASE_NUMERIC_FEATURES) {
      if (!(key in diffs)) throw new Error(`Missing feature diff: ${key}`);
    }
    return diffs;
  }

  private buildMethodProbabilities(a: FighterModelInputs, b: FighterModelInputs) {
    // Grounded in both fighters' own historical finish-method mix, rather
    // than the old proxy derived from strike/takedown accuracy alone. Two
    // fighters with no completed wins between them (e.g. both debutants)
    // fall back to a rough UFC-wide average finish distribution rather
    // than a divide-by-zero.
    const avgKo = (a.koRate + b.koRate) / 2;
    const avgSub = (a.subRate + b.subRate) / 2;
    const avgDecision = (a.decisionRate + b.decisionRate) / 2;
    const total = avgKo + avgSub + avgDecision;
    if (total === 0) return { koProbability: 0.4, subProbability: 0.2, decisionProbability: 0.4 };
    return {
      koProbability: avgKo / total,
      subProbability: avgSub / total,
      decisionProbability: avgDecision / total,
    };
  }

  private buildConfidence(
    a: FighterModelInputs,
    b: FighterModelInputs,
    missingIndicatorFeatures: string[],
  ): number {
    const dataVolume = Math.min(a.totalFights, b.totalFights);
    const featureIsPresent: Record<string, boolean> = {
      strike_accuracy_diff: a.strikeAccuracy !== null && b.strikeAccuracy !== null,
      takedown_accuracy_diff: a.takedownAccuracy !== null && b.takedownAccuracy !== null,
      avg_fight_duration_diff: a.avgFightDurationSec !== null && b.avgFightDurationSec !== null,
      height_diff_cm: a.heightCm !== null && b.heightCm !== null,
      reach_diff_cm: a.reachCm !== null && b.reachCm !== null,
      age_diff_years: a.ageYears !== null && b.ageYears !== null,
      recent_form_diff: a.recentFormRate !== null && b.recentFormRate !== null,
    };
    const presentCount = missingIndicatorFeatures.filter((f) => featureIsPresent[f]).length;
    const dataCompleteness = missingIndicatorFeatures.length > 0 ? presentCount / missingIndicatorFeatures.length : 1;
    return Math.min(0.9, (0.3 + dataVolume * 0.03) * dataCompleteness);
  }

  private buildFactors(
    a: FighterModelInputs,
    b: FighterModelInputs,
    contributions: Record<string, number>,
  ): PredictionFactor[] {
    const labels: Record<string, (favorsA: boolean) => string> = {
      elo_diff: (favorsA) =>
        `${favorsA ? a.name : b.name} has the stronger Elo rating, a running summary of who they've beaten and how.`,
      win_rate_diff: (favorsA) =>
        `${favorsA ? a.name : b.name} has the better career win rate (${pct(a.winRate)} vs ${pct(b.winRate)}).`,
      recent_form_diff: (favorsA) =>
        `${favorsA ? a.name : b.name} has the stronger record over their last 5 fights.`,
      strike_accuracy_diff: (favorsA) =>
        `${favorsA ? a.name : b.name}'s career significant-strike accuracy is notably higher (${pct(a.strikeAccuracy)} vs ${pct(b.strikeAccuracy)}).`,
      takedown_accuracy_diff: (favorsA) =>
        `${favorsA ? a.name : b.name} lands takedowns at a higher rate (${pct(a.takedownAccuracy)} vs ${pct(b.takedownAccuracy)}).`,
      experience_diff: (favorsA) =>
        `${favorsA ? a.name : b.name} has significantly more UFC fights (${a.totalFights} vs ${b.totalFights}).`,
      ko_rate_diff: (favorsA) => `${favorsA ? a.name : b.name} finishes a higher share of their wins by KO/TKO.`,
      sub_rate_diff: (favorsA) => `${favorsA ? a.name : b.name} finishes a higher share of their wins by submission.`,
      decision_rate_diff: (favorsA) =>
        `${favorsA ? a.name : b.name} wins a higher share of their fights by decision.`,
      finish_rate_diff: (favorsA) => `${favorsA ? a.name : b.name} finishes fights at a notably higher rate.`,
      avg_fight_duration_diff: (favorsA) =>
        `${favorsA ? a.name : b.name}'s fights tend to run longer, a proxy for durability/cardio.`,
      height_diff_cm: (favorsA) => `${favorsA ? a.name : b.name} has a notable height advantage.`,
      reach_diff_cm: (favorsA) => `${favorsA ? a.name : b.name} has a notable reach advantage.`,
      age_diff_years: (favorsA) => `${favorsA ? a.name : b.name} is the younger fighter.`,
    };

    return Object.entries(contributions)
      .map(([factor, contribution]) => ({ factor, contribution, gap: Math.abs(contribution) }))
      .sort((x, y) => y.gap - x.gap)
      .slice(0, 3)
      .filter((c) => c.gap > 0.01)
      .map((c) => ({
        factor: c.factor,
        favors: (c.contribution > 0 ? "A" : "B") as "A" | "B",
        weight: round(Math.min(1, c.gap)),
        explanation: labels[c.factor](c.contribution > 0),
      }));
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function pct(n: number | null): string {
  return n === null ? "n/a" : `${Math.round(n * 100)}%`;
}
