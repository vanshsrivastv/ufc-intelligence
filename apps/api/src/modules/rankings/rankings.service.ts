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

    return Array.from(latestPerFighter.values())
      .sort((a, b) => a.rank - b.rank)
      .map((row) => ({
        rank: row.rank,
        fighter: toSummaryDto(row.fighter),
        effectiveDate: row.effectiveDate.toISOString(),
      }));
  }
}