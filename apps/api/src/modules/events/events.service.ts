import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@ufc-intelligence/database";
import type {
  EventDetailDto,
  EventSummaryDto,
  FightSummaryDto,
  PaginatedResult,
  WeightClassDto,
} from "@ufc-intelligence/types";
import { toSummaryDto } from "../fighters/fighters.service";
import { deriveEventStatus, eventStatusWhere } from "../../common/event-status";
import { ListEventsDto } from "./dto/list-events.dto";

@Injectable()
export class EventsService {
  async list(query: ListEventsDto): Promise<PaginatedResult<EventSummaryDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Status is a date range, not the stored column - see event-status.ts.
    const where = {
      ...(query.status ? eventStatusWhere(query.status) : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    };

    // Completed events run back to 1993, so the shared "soonest first"
    // default would bury the card that just finished behind three decades
    // of history - the opposite of what someone opening that tab wants.
    const sort = query.sort ?? (query.status === "COMPLETED" ? "date_desc" : "date_asc");

    const orderBy =
      sort === "date_desc"
        ? { date: "desc" as const }
        : sort === "recent"
          ? { createdAt: "desc" as const }
          : { date: "asc" as const };

    const [rows, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.event.count({ where }),
    ]);

    return {
      items: rows.map(toEventSummaryDto),
      total,
      page,
      pageSize,
    };
  }

  async getBySlug(slug: string): Promise<EventDetailDto> {
    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        fights: {
          include: {
            fighterA: { include: { weightClass: true } },
            fighterB: { include: { weightClass: true } },
            weightClass: true,
          },
          orderBy: { cardPosition: "asc" },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with slug "${slug}" not found`);
    }

    return {
      ...toEventSummaryDto(event),
      fights: event.fights.map(toFightSummaryDto),
    };
  }
}

function toEventSummaryDto(event: {
  id: string;
  slug: string;
  name: string;
  date: Date;
  venue: string | null;
  city: string | null;
  country: string | null;
}): EventSummaryDto {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    date: event.date.toISOString(),
    venue: event.venue,
    city: event.city,
    country: event.country,
    status: deriveEventStatus(event.date),
  };
}

function toFightSummaryDto(fight: any): FightSummaryDto {
  return {
    id: fight.id,
    fighterA: toSummaryDto(fight.fighterA),
    fighterB: toSummaryDto(fight.fighterB),
    weightClass: fight.weightClass ? toWeightClassDto(fight.weightClass) : null,
    isTitleFight: fight.isTitleFight,
    cardPosition: fight.cardPosition,
    status: fight.status,
    method: fight.method,
    round: fight.round,
    time: fight.time,
    winnerId: fight.winnerId,
  };
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
