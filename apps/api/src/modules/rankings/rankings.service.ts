import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ufc-intelligence/database";
import type { RankingEntryDto, WeightClassDto } from "@ufc-intelligence/types";
import { toSummaryDto } from "../fighters/fighters.service";
import { ListRankingsDto } from "./dto/list-rankings.dto";

@Injectable()
export class RankingsService {
  async listWeightClasses(): Promise<WeightClassDto[]> {
    const rows = await prisma.weightClass.findMany({ orderBy: { weightLimitLbs: "asc" } });
    return rows.map((wc) => ({
      id: wc.id,
      name: wc.name,
      weightLimitLbs: wc.weightLimitLbs,
      isWomens: wc.isWomens,
    }));
  }

  async list(query: ListRankingsDto): Promise<RankingEntryDto[]> {
    if (!query.weightClass) {
      // No division specified — return nothing rather than guessing one,
      // so the frontend is explicit about which division it's asking for.
      return [];
    }

    const weightClass = await prisma.weightClass.findUnique({
      where: { name: query.weightClass },
    });

    if (!weightClass) {
      throw new NotFoundException(`Weight class "${query.weightClass}" not found`);
    }

    // A fighter can have multiple historical Ranking rows (rankings change
    // over time, per the versioned effectiveDate design in architecture.md).
    // We want only each fighter's most recent entry, then sorted by rank.
    const allRows = await prisma.ranking.findMany({
      where: { weightClassId: weightClass.id },
      include: { fighter: { include: { weightClass: true } } },
      orderBy: { effectiveDate: "desc" },
    });

    const latestPerFighter = new Map<string, (typeof allRows)[number]>();
    for (const row of allRows) {
      if (!latestPerFighter.has(row.fighterId)) {
        latestPerFighter.set(row.fighterId, row);
      }
    }

    const entries = Array.from(latestPerFighter.values()).sort((a, b) => a.rank - b.rank);
    const fighterIds = entries.map((e) => e.fighterId);
    const statusByFighter = await this.computeActivityStatus(fighterIds);
    const eloRankByFighter = await this.computeEloRanksForDivision(weightClass.id, fighterIds);

    return entries.map((row) => ({
      rank: row.rank,
      fighter: toSummaryDto(row.fighter),
      effectiveDate: row.effectiveDate.toISOString(),
      status: statusByFighter.get(row.fighterId) ?? "inactive",
      eloRank: eloRankByFighter.get(row.fighterId) ?? null,
    }));
  }

  // Rankings purely by Elo, no official ranking involved - "#1 Elo" isn't
  // necessarily the champion, so this deliberately does NOT reuse rank 0
  // for the top spot the way official rankings do (that convention means
  // "holds the title," which Elo has no way to know).
  async listByElo(query: ListRankingsDto): Promise<RankingEntryDto[]> {
    if (!query.weightClass) return [];

    const weightClass = await prisma.weightClass.findUnique({
      where: { name: query.weightClass },
    });
    if (!weightClass) {
      throw new NotFoundException(`Weight class "${query.weightClass}" not found`);
    }

    // Same union computeEloRanksForDivision uses, for the same reason:
    // Fighter.weightClassId alone would silently drop anyone officially
    // ranked in this division after a recent move up/down in weight -
    // confirmed live, this tab was missing the reigning Welterweight
    // champion (Islam Makhachev) from the Welterweight Elo list, while
    // the Official tab correctly showed him as Elo #1 in that same
    // division. Both tabs have to agree.
    const currentlyRankedHere = await prisma.ranking.findMany({
      where: { weightClassId: weightClass.id },
      distinct: ["fighterId"],
      select: { fighterId: true },
    });

    const [byDivision, byOfficialRanking] = await Promise.all([
      prisma.fighter.findMany({
        where: { weightClassId: weightClass.id, eloRating: { not: null } },
        include: { weightClass: true },
      }),
      prisma.fighter.findMany({
        where: { id: { in: currentlyRankedHere.map((r) => r.fighterId) }, eloRating: { not: null } },
        include: { weightClass: true },
      }),
    ]);

    const byId = new Map(byDivision.map((f) => [f.id, f]));
    for (const f of byOfficialRanking) byId.set(f.id, f);

    const rated = [...byId.values()].sort((a, b) => b.eloRating! - a.eloRating!).slice(0, 15);

    const fighterIds = rated.map((f) => f.id);
    const statusByFighter = await this.computeActivityStatus(fighterIds);

    return rated.map((fighter, i) => ({
      rank: i + 1,
      fighter: toSummaryDto(fighter),
      effectiveDate: new Date().toISOString(),
      status: statusByFighter.get(fighter.id) ?? "inactive",
      eloRank: i + 1,
    }));
  }

  // Step 6 of the Elo plan: where would Elo place each officially-ranked
  // fighter within their own division? Scoped to the whole division's
  // rated fighters, not just the other 15 names on the official list -
  // "#3 by Elo" should mean third overall in the division, not third
  // among a pre-selected set.
  //
  // officialFighterIds is unioned in on top of the weightClassId match,
  // not just an extra filter - Fighter.weightClassId reflects a
  // fighter's career-majority division, which can differ from the
  // division they're CURRENTLY officially ranked in for anyone who
  // recently moved up/down in weight. Confirmed live: Islam Makhachev's
  // fighter record still says Lightweight (most of his career), but the
  // Ranking table correctly has him as Welterweight champion - scoping
  // by weightClassId alone silently excluded him from his own division's
  // Elo pool, which is why his Elo rank wasn't showing up at all.
  private async computeEloRanksForDivision(
    weightClassId: string,
    officialFighterIds: string[],
  ): Promise<Map<string, number>> {
    const [byDivision, byOfficialRanking] = await Promise.all([
      prisma.fighter.findMany({
        where: { weightClassId, eloRating: { not: null } },
        select: { id: true, eloRating: true },
      }),
      prisma.fighter.findMany({
        where: { id: { in: officialFighterIds }, eloRating: { not: null } },
        select: { id: true, eloRating: true },
      }),
    ]);

    const byId = new Map(byDivision.map((f) => [f.id, f]));
    for (const f of byOfficialRanking) byId.set(f.id, f);

    const rated = [...byId.values()].sort((a, b) => b.eloRating! - a.eloRating!);
    const eloRankByFighter = new Map<string, number>();
    rated.forEach((f, i) => eloRankByFighter.set(f.id, i + 1));
    return eloRankByFighter;
  }

  // "Active" is judged relative to the most recent event date in the whole
  // dataset, not real-world today — the imported dataset is a historical
  // snapshot, so anchoring to wall-clock time would mislabel everyone as
  // inactive once the data is more than ~18 months old.
  private async computeActivityStatus(
    fighterIds: string[],
  ): Promise<Map<string, "active" | "inactive">> {
    if (fighterIds.length === 0) return new Map();

    const [mostRecentEvent, fights] = await Promise.all([
      prisma.event.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
      prisma.fight.findMany({
        where: {
          status: "COMPLETED",
          OR: [{ fighterAId: { in: fighterIds } }, { fighterBId: { in: fighterIds } }],
        },
        select: { fighterAId: true, fighterBId: true, event: { select: { date: true } } },
      }),
    ]);

    const datasetNow = mostRecentEvent?.date ?? new Date();
    const activeCutoff = new Date(datasetNow);
    activeCutoff.setMonth(activeCutoff.getMonth() - 18);

    const lastFightByFighter = new Map<string, Date>();
    for (const fight of fights) {
      for (const fid of [fight.fighterAId, fight.fighterBId]) {
        if (!fighterIds.includes(fid)) continue;
        const current = lastFightByFighter.get(fid);
        if (!current || fight.event.date > current) {
          lastFightByFighter.set(fid, fight.event.date);
        }
      }
    }

    const result = new Map<string, "active" | "inactive">();
    for (const id of fighterIds) {
      const lastFight = lastFightByFighter.get(id);
      result.set(id, lastFight && lastFight >= activeCutoff ? "active" : "inactive");
    }
    return result;
  }
}