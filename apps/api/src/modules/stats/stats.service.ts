import { Injectable } from "@nestjs/common";
import { prisma } from "@ufc-intelligence/database";

@Injectable()
export class StatsService {
  async getOverview() {
    const [fighters, fights, events, weightClasses] = await Promise.all([
      prisma.fighter.count(),
      prisma.fight.count({ where: { status: "COMPLETED" } }),
      prisma.event.count(),
      prisma.weightClass.count(),
    ]);
    return { fighters, fights, events, weightClasses };
  }

  async getChampions() {
    const champions = await prisma.ranking.findMany({
      where: { rank: 0 },
      include: { fighter: true, weightClass: true },
      orderBy: { effectiveDate: "desc" },
      distinct: ["weightClassId"],
    });
    return champions.map((c) => ({
      fighterId: c.fighter.id,
      slug: c.fighter.slug,
      name: c.fighter.name,
      photoUrl: c.fighter.photoUrl,
      weightClass: c.weightClass.name,
      record: `${c.fighter.wins}-${c.fighter.losses}-${c.fighter.draws}`,
    }));
  }

  async getLeaderboards() {
    const mostWins = await prisma.fighter.findMany({
      orderBy: { wins: "desc" },
      take: 10,
      select: { id: true, slug: true, name: true, wins: true },
    });

    const mostFinishes = await this.methodLeaderboard(["TKO", "SUBMISSION"], "finishes");
    const mostKOWins = await this.methodLeaderboard(["TKO"], "kos");
    const mostSubmissionWins = await this.methodLeaderboard(["SUBMISSION"], "submissions");

    // Longest win streak — scoped to top 150 by win count (see conversation
    // notes: computing this across all fighters would be too expensive
    // without a caching layer yet).
    const winStreakCandidates = await prisma.fighter.findMany({
      orderBy: { wins: "desc" },
      take: 150,
      select: { id: true, slug: true, name: true },
    });
    const candidateIds = winStreakCandidates.map((f) => f.id);
    const candidateIdSet = new Set(candidateIds);
    // Single query covering all 150 candidates instead of one query per
    // fighter — the previous version issued up to 150 sequential
    // round-trips per request.
    const candidateFights = await prisma.fight.findMany({
      where: {
        status: "COMPLETED",
        OR: [{ fighterAId: { in: candidateIds } }, { fighterBId: { in: candidateIds } }],
      },
      select: {
        fighterAId: true,
        fighterBId: true,
        winnerId: true,
        event: { select: { date: true } },
      },
      orderBy: { event: { date: "asc" } },
    });

    const fightsByFighter = new Map<string, typeof candidateFights>();
    for (const fight of candidateFights) {
      for (const fid of [fight.fighterAId, fight.fighterBId]) {
        if (!candidateIdSet.has(fid)) continue;
        if (!fightsByFighter.has(fid)) fightsByFighter.set(fid, []);
        fightsByFighter.get(fid)!.push(fight);
      }
    }

    const streaks = winStreakCandidates.map((fighter) => {
      const fights = fightsByFighter.get(fighter.id) ?? [];
      let current = 0;
      let best = 0;
      for (const fight of fights) {
        if (fight.winnerId === fighter.id) {
          current++;
          best = Math.max(best, current);
        } else if (fight.winnerId !== null) {
          current = 0;
        }
      }
      return { ...fighter, streak: best };
    });
    const longestWinStreak = streaks.sort((a, b) => b.streak - a.streak).slice(0, 10);

    // Most title fights — a fighter can be on either side of the Fight
    // row, so this can't be a simple groupBy on one column; tally in memory.
    const titleFights = await prisma.fight.findMany({
      where: { isTitleFight: true, status: "COMPLETED" },
      select: { fighterAId: true, fighterBId: true },
    });
    const titleFightCounts = new Map<string, number>();
    for (const f of titleFights) {
      titleFightCounts.set(f.fighterAId, (titleFightCounts.get(f.fighterAId) ?? 0) + 1);
      titleFightCounts.set(f.fighterBId, (titleFightCounts.get(f.fighterBId) ?? 0) + 1);
    }
    const topTitleFighterIds = Array.from(titleFightCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);
    const titleFighters = await prisma.fighter.findMany({
      where: { id: { in: topTitleFighterIds } },
      select: { id: true, slug: true, name: true },
    });
    const mostTitleFights = topTitleFighterIds
      .map((id) => {
        const fighter = titleFighters.find((f) => f.id === id);
        return fighter ? { ...fighter, titleFights: titleFightCounts.get(id)! } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Best striking accuracy — minimum-attempts threshold so a fighter with
    // a handful of lucky strikes can't outrank someone with real volume.
    const MIN_ATTEMPTS = 200;
    const strikeAgg = await prisma.fightStat.groupBy({
      by: ["fighterId"],
      where: { round: 0 },
      _sum: { sigStrikesLanded: true, sigStrikesAttempted: true },
    });
    const qualifying = strikeAgg
      .filter((s) => (s._sum.sigStrikesAttempted ?? 0) >= MIN_ATTEMPTS)
      .map((s) => ({
        fighterId: s.fighterId,
        accuracy: (s._sum.sigStrikesLanded ?? 0) / (s._sum.sigStrikesAttempted ?? 1),
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 10);
    const accuracyFighters = await prisma.fighter.findMany({
      where: { id: { in: qualifying.map((q) => q.fighterId) } },
      select: { id: true, slug: true, name: true },
    });
    const bestStrikeAccuracy = qualifying
      .map((q) => {
        const fighter = accuracyFighters.find((f) => f.id === q.fighterId);
        return fighter
          ? { ...fighter, accuracyPct: Math.round(q.accuracy * 1000) / 10 }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Method-of-victory breakdown for the donut/bar
    const methodCounts = await prisma.fight.groupBy({
      by: ["method"],
      where: {
        winnerId: { not: null },
        method: {
          in: ["TKO", "SUBMISSION", "DECISION_UNANIMOUS", "DECISION_SPLIT", "DECISION_MAJORITY"],
        },
      },
      _count: { method: true },
    });
    const koTko = methodCounts.find((m) => m.method === "TKO")?._count.method ?? 0;
    const submission = methodCounts.find((m) => m.method === "SUBMISSION")?._count.method ?? 0;
    const decision = methodCounts
      .filter((m) => m.method.startsWith("DECISION"))
      .reduce((s, m) => s + m._count.method, 0);

    return {
      mostWins,
      mostFinishes,
      mostKOWins,
      mostSubmissionWins,
      longestWinStreak,
      mostTitleFights,
      bestStrikeAccuracy,
      methodBreakdown: { koTko, submission, decision, total: koTko + submission + decision },
    };
  }

  private async methodLeaderboard(methods: string[], key: string) {
    const groups = await prisma.fight.groupBy({
      by: ["winnerId"],
      where: { winnerId: { not: null }, method: { in: methods as any } },
      _count: { winnerId: true },
      orderBy: { _count: { winnerId: "desc" } },
      take: 10,
    });
    const ids = groups.map((g) => g.winnerId!).filter(Boolean);
    const fighters = await prisma.fighter.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true, name: true },
    });
    return groups
      .map((g) => {
        const fighter = fighters.find((f) => f.id === g.winnerId);
        return fighter ? { ...fighter, [key]: g._count.winnerId } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }
}