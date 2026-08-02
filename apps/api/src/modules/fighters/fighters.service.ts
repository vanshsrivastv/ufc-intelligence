import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ufc-intelligence/database";
import type {
  FighterDetailDto,
  FighterSummaryDto,
  PaginatedResult,
} from "@ufc-intelligence/types";
import { ListFightersDto } from "./dto/list-fighters.dto";

@Injectable()
export class FightersService {
  async list(query: ListFightersDto): Promise<PaginatedResult<FighterSummaryDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let championOnlyIds: string[] | undefined;
    if (query.championOnly) {
      const champions = await prisma.ranking.findMany({
        where: { rank: 0 },
        orderBy: { effectiveDate: "desc" },
        distinct: ["weightClassId"],
        select: { fighterId: true },
      });
      championOnlyIds = champions.map((c) => c.fighterId);
    }

    let activityCutoff: Date | undefined;
    if (query.activity) {
      const mostRecentEvent = await prisma.event.findFirst({
        orderBy: { date: "desc" },
        select: { date: true },
      });
      const cutoff = new Date(mostRecentEvent?.date ?? new Date());
      cutoff.setMonth(cutoff.getMonth() - 18);
      activityCutoff = cutoff;
    }

    const where = {
      ...(query.weightClass ? { weightClass: { name: query.weightClass } } : {}),
      ...(query.gender ? { weightClass: { isWomens: query.gender === "women" } } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
      ...(championOnlyIds ? { id: { in: championOnlyIds } } : {}),
      ...(activityCutoff
        ? query.activity === "active"
          ? { lastFightDate: { gte: activityCutoff } }
          : { OR: [{ lastFightDate: { lt: activityCutoff } }, { lastFightDate: null }] }
        : {}),
    };

    const orderBy =
      query.sort === "recent"
        ? { createdAt: "desc" as const }
        : query.sort === "oldest"
          ? { createdAt: "asc" as const }
          : { name: "asc" as const };

    const [rows, total] = await Promise.all([
      prisma.fighter.findMany({
        where,
        include: { weightClass: true },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.fighter.count({ where }),
    ]);

    return {
      items: rows.map(toSummaryDto),
      total,
      page,
      pageSize,
    };
  }

  async getBySlug(slug: string): Promise<FighterDetailDto> {
    const fighter = await prisma.fighter.findUnique({
      where: { slug },
      include: {
        weightClass: true,
        fightStats: true,
        fightsAsA: {
          include: { fighterA: true, fighterB: true, weightClass: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        fightsAsB: {
          include: { fighterA: true, fighterB: true, weightClass: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!fighter) {
      throw new NotFoundException(`Fighter with slug "${slug}" not found`);
    }

    // Most recent Ranking row for this fighter, if any (rankings module
    // landed after this comment was originally written — now wired up).
    const latestRanking = await prisma.ranking.findFirst({
      where: { fighterId: fighter.id },
      orderBy: { effectiveDate: "desc" },
    });

    // Career totals are computed from per-fight totals (round = 0), not
    // recomputed from per-round rows here — that aggregation belongs to the
    // ingestion module's post-processing step (architecture.md §8), which
    // keeps this read path fast.
    const totals = fighter.fightStats.filter((s) => s.round === 0);
    const totalStrikesAttempted = totals.reduce((sum, s) => sum + s.sigStrikesAttempted, 0);
    const totalStrikesLanded = totals.reduce((sum, s) => sum + s.sigStrikesLanded, 0);
    const allFights = [...fighter.fightsAsA, ...fighter.fightsAsB];
    const wins = allFights.filter((f) => f.winnerId === fighter.id);
    const koTkoWins = wins.filter((f) => f.method === "KO" || f.method === "TKO").length;
    const submissionWins = wins.filter((f) => f.method === "SUBMISSION").length;
    const decisionWins = wins.filter((f) => f.method.startsWith("DECISION")).length;

    const recentFights = [...fighter.fightsAsA, ...fighter.fightsAsB]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      id: fighter.id,
      slug: fighter.slug,
      name: fighter.name,
      nickname: fighter.nickname,
      dob: fighter.dob?.toISOString() ?? null,
      nationality: fighter.nationality,
      heightCm: fighter.heightCm,
      reachCm: fighter.reachCm,
      gym: fighter.gym,
      coach: fighter.coach,
      photoUrl: fighter.photoUrl,
      photoCredit: fighter.photoCredit,
      photoLicense: fighter.photoLicense,
      photoLicenseUrl: fighter.photoLicenseUrl,
      rank: latestRanking?.rank ?? null,
      record: {
        wins: fighter.wins,
        losses: fighter.losses,
        draws: fighter.draws,
        noContests: fighter.noContests,
      },
      weightClass: fighter.weightClass
        ? {
            id: fighter.weightClass.id,
            name: fighter.weightClass.name,
            weightLimitLbs: fighter.weightClass.weightLimitLbs,
            isWomens: fighter.weightClass.isWomens,
          }
        : null,
      careerStats: {
        // Prefer the dataset-sourced career rate (fighters.csv, via
        // import-dataset.ts); fall back to computing accuracy from
        // recorded FightStat totals if the dataset value is missing.
        sigStrikesLandedPerMin: fighter.sigStrikesLandedPerMin ?? null,
        sigStrikeAccuracyPct:
          fighter.sigStrikeAccuracyPct ??
          (totalStrikesAttempted > 0
            ? Math.round((totalStrikesLanded / totalStrikesAttempted) * 1000) / 10
            : null),
        takedownAvgPer15Min: fighter.takedownAvgPer15Min ?? null,
        takedownAccuracyPct: fighter.takedownAccuracyPct ?? null,
        takedownDefensePct: fighter.takedownDefensePct ?? null,
        submissionAvgPer15Min: fighter.submissionAvgPer15Min ?? null,
        koTkoWins,
        submissionWins,
        decisionWins,
      },
      recentFights: recentFights.map((f) => ({
        id: f.id,
        fighterA: toSummaryDto(f.fighterA as any),
        fighterB: toSummaryDto(f.fighterB as any),
        weightClass: null,
        isTitleFight: f.isTitleFight,
        cardPosition: f.cardPosition,
        status: f.status,
        method: f.method,
        round: f.round,
        time: f.time,
        winnerId: f.winnerId,
      })),
    };
  }
}

export function toSummaryDto(fighter: {
  id: string;
  slug: string;
  name: string;
  nickname: string | null;
  photoUrl: string | null;
  photoCredit?: string | null;
  photoLicense?: string | null;
  photoLicenseUrl?: string | null;
  wins: number;
  losses: number;
  draws: number;
  noContests: number;
  weightClass?: { id: string; name: string; weightLimitLbs: number; isWomens: boolean } | null;
}): FighterSummaryDto {
  return {
    id: fighter.id,
    slug: fighter.slug,
    name: fighter.name,
    nickname: fighter.nickname,
    photoUrl: fighter.photoUrl,
    photoCredit: fighter.photoCredit ?? null,
    photoLicense: fighter.photoLicense ?? null,
    photoLicenseUrl: fighter.photoLicenseUrl ?? null,
    rank: null,
    record: {
      wins: fighter.wins,
      losses: fighter.losses,
      draws: fighter.draws,
      noContests: fighter.noContests,
    },
    weightClass: fighter.weightClass ?? null,
  };
}