import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ufc-intelligence/database";
import type { PredictionDto, PredictionFactor } from "@ufc-intelligence/types";

interface FighterFeatures {
  id: string;
  name: string;
  totalFights: number;
  winRate: number;
  recentFormRate: number | null; // null if no completed fights recorded
  strikeAccuracy: number | null; // null if no attempts recorded at all
  takedownAccuracy: number | null;
  avgFinishRound: number | null;
}

interface Category {
  key: string;
  weight: number;
  valid: boolean;
  shareA: number; // meaningless if !valid
}

@Injectable()
export class PredictionsService {
  async getMatchup(fighterASlug: string, fighterBSlug: string): Promise<PredictionDto> {
    await this.assertSameGender(fighterASlug, fighterBSlug);

    const [a, b] = await Promise.all([
      this.buildFeatures(fighterASlug),
      this.buildFeatures(fighterBSlug),
    ]);

    const categories: Category[] = [
      {
        key: "win_rate",
        weight: 0.3,
        valid: a.totalFights > 0 && b.totalFights > 0,
        shareA: share(a.winRate, b.winRate),
      },
      {
        key: "recent_form",
        weight: 0.25,
        valid: a.recentFormRate !== null && b.recentFormRate !== null,
        shareA: share((a.recentFormRate ?? 0) + 0.01, (b.recentFormRate ?? 0) + 0.01),
      },
      {
        key: "striking_accuracy",
        weight: 0.2,
        valid: a.strikeAccuracy !== null && b.strikeAccuracy !== null,
        shareA: share(a.strikeAccuracy ?? 0, b.strikeAccuracy ?? 0),
      },
      {
        key: "takedown_accuracy",
        weight: 0.15,
        valid: a.takedownAccuracy !== null && b.takedownAccuracy !== null,
        shareA: share(a.takedownAccuracy ?? 0, b.takedownAccuracy ?? 0),
      },
      {
        key: "experience",
        weight: 0.05,
        valid: true,
        shareA: share(a.totalFights, b.totalFights),
      },
      {
        key: "cardio",
        weight: 0.05,
        valid: a.avgFinishRound !== null && b.avgFinishRound !== null,
        shareA: share(a.avgFinishRound ?? 0, b.avgFinishRound ?? 0),
      },
    ];

    const validCategories = categories.filter((c) => c.valid);
    const totalValidWeight = validCategories.reduce((s, c) => s + c.weight, 0);
    const totalWeight = categories.reduce((s, c) => s + c.weight, 0);

    const rawScoreA =
      totalValidWeight > 0
        ? validCategories.reduce((sum, c) => sum + c.shareA * (c.weight / totalValidWeight), 0)
        : 0.5;

    const winnerProbabilityA = 0.25 + rawScoreA * 0.5;
    const winnerProbabilityB = 1 - winnerProbabilityA;

    const dataVolume = Math.min(a.totalFights, b.totalFights);
    const dataCompleteness = totalWeight > 0 ? totalValidWeight / totalWeight : 0;
    const confidenceScore = Math.min(0.9, (0.3 + dataVolume * 0.03) * dataCompleteness);

    const koProbability = clamp01(((a.strikeAccuracy ?? 0.3) + (b.strikeAccuracy ?? 0.3)) / 2.5);
    const subProbability = clamp01(((a.takedownAccuracy ?? 0.2) + (b.takedownAccuracy ?? 0.2)) / 3);
    const decisionProbability = clamp01(1 - koProbability - subProbability);

    const topFactors = this.buildFactors(a, b, validCategories);

    return {
      fightId: `matchup-${a.id}-${b.id}`,
      modelVersion: "v2-explainable-heuristic",
      winnerProbabilityA: round(winnerProbabilityA),
      winnerProbabilityB: round(winnerProbabilityB),
      koProbability: round(koProbability),
      subProbability: round(subProbability),
      decisionProbability: round(decisionProbability),
      confidenceScore: round(confidenceScore),
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

  private async buildFeatures(slug: string): Promise<FighterFeatures> {
    const fighter = await prisma.fighter.findUnique({
      where: { slug },
      include: {
        fightsAsA: true,
        fightsAsB: true,
      },
    });
    if (!fighter) throw new NotFoundException(`Fighter with slug "${slug}" not found`);

    const allFights = [...fighter.fightsAsA, ...fighter.fightsAsB].filter(
      (f) => f.status === "COMPLETED",
    );
    const totalFights = allFights.length;
    const wins = allFights.filter((f) => f.winnerId === fighter.id).length;
    const winRate = totalFights > 0 ? wins / totalFights : 0.5;

    const recent = allFights
      .slice()
      .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
      .slice(0, 5);
    const recentFormRate =
      recent.length > 0 ? recent.filter((f) => f.winnerId === fighter.id).length / recent.length : null;

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

    const roundsEnded = allFights.map((f) => f.round).filter((r): r is number => !!r && r > 0);
    const avgFinishRound =
      roundsEnded.length > 0 ? roundsEnded.reduce((s, r) => s + r, 0) / roundsEnded.length : null;

    return {
      id: fighter.id,
      name: fighter.name,
      totalFights,
      winRate,
      recentFormRate,
      strikeAccuracy,
      takedownAccuracy,
      avgFinishRound,
    };
  }

  private buildFactors(
    a: FighterFeatures,
    b: FighterFeatures,
    validCategories: Category[],
  ): PredictionFactor[] {
    const labels: Record<string, (favorsA: boolean) => string> = {
      striking_accuracy: (favorsA) =>
        `${favorsA ? a.name : b.name}'s career significant-strike accuracy is notably higher (${pct(a.strikeAccuracy)} vs ${pct(b.strikeAccuracy)}).`,
      takedown_accuracy: (favorsA) =>
        `${favorsA ? a.name : b.name} lands takedowns at a higher rate (${pct(a.takedownAccuracy)} vs ${pct(b.takedownAccuracy)}).`,
      recent_form: (favorsA) =>
        `${favorsA ? a.name : b.name} has the stronger record over their last 5 fights.`,
      win_rate: (favorsA) =>
        `${favorsA ? a.name : b.name} has the better career win rate (${pct(a.winRate)} vs ${pct(b.winRate)}).`,
      experience: (favorsA) =>
        `${favorsA ? a.name : b.name} has significantly more UFC fights (${a.totalFights} vs ${b.totalFights}).`,
      cardio: (favorsA) =>
        `${favorsA ? a.name : b.name} more often goes into later rounds, a proxy for durability/cardio.`,
    };

    return validCategories
      .map((c) => ({ ...c, gap: Math.abs(c.shareA - 0.5) }))
      .sort((x, y) => y.gap - x.gap)
      .slice(0, 3)
      .filter((c) => c.gap > 0.03)
      .map((c) => ({
        factor: c.key,
        favors: (c.shareA > 0.5 ? "A" : "B") as "A" | "B",
        weight: round(c.gap * 2),
        explanation: labels[c.key](c.shareA > 0.5),
      }));
  }
}

function share(x: number, y: number): number {
  const total = x + y;
  if (total === 0) return 0.5;
  return x / total;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function pct(n: number | null): string {
  return n === null ? "n/a" : `${Math.round(n * 100)}%`;
}