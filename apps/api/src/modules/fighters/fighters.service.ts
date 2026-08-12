import { Injectable, NotFoundException } from "@nestjs/common";
import { FightMethod, FightStatus, prisma } from "@ufc-intelligence/database";
import type {
  ComparePercentilesDto,
  FighterDetailDto,
  FighterSummaryDto,
  PaginatedResult,
  StatPercentiles,
} from "@ufc-intelligence/types";
import { ListFightersDto } from "./dto/list-fighters.dto";

const NULL_PERCENTILES: StatPercentiles = {
  elo: null,
  strikeAccuracy: null,
  takedownAccuracy: null,
  takedownDefense: null,
  finishRate: null,
  winRate: null,
  strikesLandedPerMin: null,
  takedownAvg: null,
  submissionAvg: null,
  koRate: null,
  submissionRate: null,
  decisionRate: null,
};

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
            : // elo_desc/elo_asc: nulls: "last" regardless of direction - a
              // fighter with no computed Elo isn't "the lowest rated," they're
              // unrated, and have to sort to the bottom either way rather than
              // landing above real ratings on elo_asc the way a default
              // database value would (the whole reason eloRating is nullable
              // rather than defaulting to 1500 - see schema.prisma).
              query.sort === "elo_desc"
              ? [{ eloRating: { sort: "desc" as const, nulls: "last" as const } }, { name: "asc" as const }]
              : query.sort === "elo_asc"
                ? [{ eloRating: { sort: "asc" as const, nulls: "last" as const } }, { name: "asc" as const }]
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

    // 1-indexed position among every fighter with a computed Elo - a
    // plain count of strictly-higher ratings plus one, not a stored/
    // cached value, since it has to stay correct as compute-elo.ts
    // rewrites ratings out from under it. Skipped entirely (stays null)
    // for a fighter with no rating of their own - "rank" isn't a
    // meaningful concept for someone who was never rated.
    const eloRank =
      fighter.eloRating !== null
        ? (await prisma.fighter.count({ where: { eloRating: { gt: fighter.eloRating } } })) + 1
        : null;

    // Empty for elo: null rather than a separate query - a fighter with
    // no current rating has no history rows either, since both are
    // written together by the same compute-elo.ts walk.
    const eloHistory =
      fighter.eloRating !== null
        ? await prisma.eloHistory.findMany({
            where: { fighterId: fighter.id },
            orderBy: { eventDate: "asc" },
            select: { eventDate: true, eloAfter: true },
          })
        : [];

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
      elo: fighter.eloRating,
      eloRank,
      eloFightCount: completedFights.length,
      eloHistory: eloHistory.map((h) => ({ date: h.eventDate.toISOString(), elo: h.eloAfter })),
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

  // Powers the Compare page's radar chart. Every value is this fighter's
  // percentile rank (0-100) against every OTHER rated fighter in the
  // whole roster - not scoped to their own weight class (a real,
  // deliberate limitation flagged for later, not an oversight: a
  // heavyweight's takedown rate isn't really comparable to a flyweight's
  // in absolute terms).
  //
  // One bulk fetch of every rated fighter's raw stats, plus one bulk
  // fetch of every completed fight for KO/submission/decision tallying,
  // then everything else is computed in memory - the same "one query,
  // tally in a Map" shape getLeaderboards() already uses for
  // mostActiveFighters/mostTitleFights, not 24 separate percentile
  // queries (12 stats x 2 fighters) hitting the database.
  async getComparePercentiles(slugA: string, slugB: string): Promise<ComparePercentilesDto> {
    const [fighterA, fighterB] = await Promise.all([
      prisma.fighter.findUnique({ where: { slug: slugA }, select: { id: true } }),
      prisma.fighter.findUnique({ where: { slug: slugB }, select: { id: true } }),
    ]);
    if (!fighterA) throw new NotFoundException(`Fighter with slug "${slugA}" not found`);
    if (!fighterB) throw new NotFoundException(`Fighter with slug "${slugB}" not found`);

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

    type MetricKey = keyof StatPercentiles;
    const metricsById = new Map<string, Record<MetricKey, number | null>>();
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
      });
    }

    const metricKeys = Object.keys(NULL_PERCENTILES) as MetricKey[];
    // Sorted, null-free value arrays per metric - the population a given
    // fighter's raw value gets ranked against.
    const sortedValues = new Map<MetricKey, number[]>();
    for (const key of metricKeys) {
      const values = [...metricsById.values()]
        .map((m) => m[key])
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
      sortedValues.set(key, values);
    }

    function percentileOf(key: MetricKey, value: number | null): number | null {
      if (value === null) return null;
      const values = sortedValues.get(key)!;
      if (values.length === 0) return null;
      let lower = 0;
      for (const v of values) {
        if (v < value) lower++;
      }
      return Math.round((lower / values.length) * 100);
    }

    function statPercentilesFor(fighterId: string): StatPercentiles {
      const metrics = metricsById.get(fighterId);
      if (!metrics) return NULL_PERCENTILES;
      const result = {} as StatPercentiles;
      for (const key of metricKeys) {
        result[key] = percentileOf(key, metrics[key]);
      }
      return result;
    }

    return {
      fighterA: statPercentilesFor(fighterA.id),
      fighterB: statPercentilesFor(fighterB.id),
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
  eloRating?: number | null;
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
    elo: fighter.eloRating ?? null,
    record: {
      wins: fighter.wins,
      losses: fighter.losses,
      draws: fighter.draws,
      noContests: fighter.noContests,
    },
    weightClass: fighter.weightClass ?? null,
  };
}