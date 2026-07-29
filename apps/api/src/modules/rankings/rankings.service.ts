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

    return entries.map((row) => ({
      rank: row.rank,
      fighter: toSummaryDto(row.fighter),
      effectiveDate: row.effectiveDate.toISOString(),
      status: statusByFighter.get(row.fighterId) ?? "inactive",
    }));
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