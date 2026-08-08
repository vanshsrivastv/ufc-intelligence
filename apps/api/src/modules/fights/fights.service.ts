import { Injectable, NotFoundException } from "@nestjs/common";
import { FightMethod, prisma } from "@ufc-intelligence/database";
import type {
  FighterAtFightTimeDto,
  FightDetailDto,
  PreviousMeetingDto,
  WeightClassDto,
} from "@ufc-intelligence/types";
import { toSummaryDto } from "../fighters/fighters.service";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const KO_METHODS: FightMethod[] = ["KO", "TKO"];

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

    const [fighterAAtFightTime, fighterBAtFightTime] = await Promise.all([
      this.buildAtFightTime(fight.fighterA.id, fight.fighterA.dob, fight.event.date),
      this.buildAtFightTime(fight.fighterB.id, fight.fighterB.dob, fight.event.date),
    ]);

    return {
      id: fight.id,
      event: {
        slug: fight.event.slug,
        name: fight.event.name,
        date: fight.event.date.toISOString(),
      },
      weightClass: toWeightClassDto(fight.weightClass),
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
      fighterAAtFightTime,
      fighterBAtFightTime,
    };
  }

  // "At fight time" - age and record as they stood on the day of this
  // fight, not today. Age off dob vs. this fight's own event date rather
  // than Date.now(), and record/finish-breakdown from only the fights
  // that happened strictly BEFORE this one (excludes this fight's own
  // result - "record entering the fight", not "record after it").
  private async buildAtFightTime(
    fighterId: string,
    dob: Date | null,
    fightDate: Date,
  ): Promise<FighterAtFightTimeDto> {
    const priorFights = await prisma.fight.findMany({
      where: {
        status: "COMPLETED",
        event: { date: { lt: fightDate } },
        OR: [{ fighterAId: fighterId }, { fighterBId: fighterId }],
      },
      select: { winnerId: true, method: true },
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let noContests = 0;
    let koTkoWins = 0;
    let submissionWins = 0;

    for (const f of priorFights) {
      if (f.winnerId === fighterId) {
        wins++;
        if (KO_METHODS.includes(f.method)) koTkoWins++;
        else if (f.method === "SUBMISSION") submissionWins++;
      } else if (f.winnerId !== null) {
        losses++;
      } else if (f.method === "NO_CONTEST") {
        noContests++;
      } else {
        draws++;
      }
    }

    const age = dob ? Math.floor((fightDate.getTime() - dob.getTime()) / MS_PER_YEAR) : null;

    return { age, record: { wins, losses, draws, noContests }, koTkoWins, submissionWins };
  }
}

// "Unknown" is a real row (see scrape-upcoming.ts) used for fights whose
// weight class couldn't be scraped, not a division fighters actually
// compete in - treat it the same as no weight class at all.
function toWeightClassDto(
  weightClass: { id: string; name: string; weightLimitLbs: number; isWomens: boolean } | null,
): WeightClassDto | null {
  if (!weightClass || weightClass.name === "Unknown") return null;
  return {
    id: weightClass.id,
    name: weightClass.name,
    weightLimitLbs: weightClass.weightLimitLbs,
    isWomens: weightClass.isWomens,
  };
}
