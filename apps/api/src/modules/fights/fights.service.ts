import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ufc-intelligence/database";
import type { FightDetailDto, PreviousMeetingDto, WeightClassDto } from "@ufc-intelligence/types";
import { toSummaryDto } from "../fighters/fighters.service";

@Injectable()
export class FightsService {
  async getById(id: string): Promise<FightDetailDto> {
    const fight = await prisma.fight.findUnique({
      where: { id },
      include: {
        event: true,
        weightClass: true,
        fighterA: { include: { weightClass: true } },
        fighterB: { include: { weightClass: true } },
        stats: true,
      },
    });

    if (!fight) {
      throw new NotFoundException(`Fight with id "${id}" not found`);
    }

    const previousMeetings = await prisma.fight.findMany({
      where: {
        id: { not: fight.id },
        status: "COMPLETED",
        OR: [
          { fighterAId: fight.fighterAId, fighterBId: fight.fighterBId },
          { fighterAId: fight.fighterBId, fighterBId: fight.fighterAId },
        ],
      },
      include: { event: true },
      orderBy: { event: { date: "desc" } },
    });

    return {
      id: fight.id,
      event: {
        slug: fight.event.slug,
        name: fight.event.name,
        date: fight.event.date.toISOString(),
      },
      weightClass: fight.weightClass ? toWeightClassDto(fight.weightClass) : null,
      isTitleFight: fight.isTitleFight,
      status: fight.status,
      method: fight.method,
      round: fight.round,
      time: fight.time,
      fighterA: toSummaryDto(fight.fighterA),
      fighterB: toSummaryDto(fight.fighterB),
      winnerId: fight.winnerId,
      stats: fight.stats.map((s) => ({
        round: s.round,
        fighterId: s.fighterId,
        sigStrikesLanded: s.sigStrikesLanded,
        sigStrikesAttempted: s.sigStrikesAttempted,
        takedownsLanded: s.takedownsLanded,
        takedownsAttempted: s.takedownsAttempted,
        controlTimeSeconds: s.controlTimeSeconds,
        knockdowns: s.knockdowns,
        submissionAttempts: s.submissionAttempts,
      })),
      previousMeetings: previousMeetings.map(
        (m): PreviousMeetingDto => ({
          id: m.id,
          eventName: m.event.name,
          date: m.event.date.toISOString(),
          method: m.method,
          winnerId: m.winnerId,
        }),
      ),
    };
  }
}

function toWeightClassDto(weightClass: {
  id: string;
  name: string;
  weightLimitLbs: number;
  isWomens: boolean;
}): WeightClassDto {
  return {
    id: weightClass.id,
    name: weightClass.name,
    weightLimitLbs: weightClass.weightLimitLbs,
    isWomens: weightClass.isWomens,
  };
}
