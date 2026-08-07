import { Injectable, NotFoundException } from "@nestjs/common";
import { FightMethod, FightStatus, prisma } from "@ufc-intelligence/database";
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

    // Built as an explicit AND list, not flat object spread - the activity
    // filter and documentedOnly can both need their own lastFightDate
    // condition, and a second `lastFightDate` key in a spread object would
    // silently clobber the first rather than combining with it.
    const conditions: object[] = [];
    if (query.weightClass) conditions.push({ weightClass: { name: query.weightClass } });
    if (query.gender) conditions.push({ weightClass: { isWomens: query.gender === "women" } });
    if (query.search) {
      conditions.push({ name: { contains: query.search, mode: "insensitive" as const } });
    }
    if (championOnlyIds) conditions.push({ id: { in: championOnlyIds } });
    if (activityCutoff) {
      conditions.push(
        query.activity === "active"
          ? { lastFightDate: { gte: activityCutoff } }
          : { OR: [{ lastFightDate: { lt: activityCutoff } }, { lastFightDate: null }] },
      );
    }
    if (query.documentedOnly) conditions.push({ lastFightDate: { not: null } });

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const orderBy =
      query.sort === "recent"
        ? [{ createdAt: "desc" as const }]
        : query.sort === "oldest"
          ? [{ createdAt: "asc" as const }]
          : query.sort === "name_asc"
            ? [{ name: "asc" as const }]
            : // documented_first (the default): fighters with real fight-by-fight
              // history surface first, most recently active among them first;
              // the ~1,873 aggregate-only fighters sort to the very end instead
              // of being interleaved alphabetically with everyone else.
              [{ lastFightDate: { sort: "desc" as const, nulls: "last" as const } }, { name: "asc" as const }];

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
      include: { weightClass: true, fightStats: true },
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

    // A single query across both corner relations, ordered by the actual
    // event date - not createdAt (DB insert time, unrelated to when the
    // fight happened) - and never take-limited here, since koTkoWins/
    // submissionWins/decisionWins below need the fighter's ENTIRE
    // completed history, not just their 10 most-recently-inserted rows
    // (the previous per-side take:5 query undercounted every fighter with
    // more than 10 fights on record).
    const completedFights = await prisma.fight.findMany({
      where: {
        status: "COMPLETED",
        OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }],
      },
      include: { fighterA: true, fighterB: true, weightClass: true, event: true },
      orderBy: { event: { date: "desc" } },
    });

    const wins = completedFights.filter((f) => f.winnerId === fighter.id);
    const koTkoWins = wins.filter((f) => f.method === "KO" || f.method === "TKO").length;
    const submissionWins = wins.filter((f) => f.method === "SUBMISSION").length;
    const decisionWins = wins.filter((f) => f.method.startsWith("DECISION")).length;

    const recentFights = completedFights.slice(0, 5);

    // Separate from recentFights on purpose - an unfought, scheduled
    // bout isn't a "recent fight," and rendering method: "PENDING" next
    // to real results as if it were one of them is exactly the bug this
    // split fixes.
    const upcomingFight = await prisma.fight.findFirst({
      where: {
        status: "SCHEDULED",
        OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }],
      },
      include: { fighterA: true, fighterB: true, weightClass: true, event: true },
      orderBy: { event: { date: "asc" } },
    });

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
      recentFights: recentFights.map(toFightSummaryDto),
      upcomingFight: upcomingFight ? toFightSummaryDto(upcomingFight) : null,
    };
  }
}

function toFightSummaryDto(f: {
  id: string;
  event: { slug: string; name: string; date: Date };
  fighterA: Parameters<typeof toSummaryDto>[0];
  fighterB: Parameters<typeof toSummaryDto>[0];
  weightClass: { id: string; name: string; weightLimitLbs: number; isWomens: boolean } | null;
  isTitleFight: boolean;
  cardPosition: number;
  status: FightStatus;
  method: FightMethod;
  round: number | null;
  time: string | null;
  winnerId: string | null;
}) {
  return {
    id: f.id,
    event: { slug: f.event.slug, name: f.event.name, date: f.event.date.toISOString() },
    fighterA: toSummaryDto(f.fighterA),
    fighterB: toSummaryDto(f.fighterB),
    weightClass: f.weightClass,
    isTitleFight: f.isTitleFight,
    cardPosition: f.cardPosition,
    status: f.status,
    method: f.method,
    round: f.round,
    time: f.time,
    winnerId: f.winnerId,
  };
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