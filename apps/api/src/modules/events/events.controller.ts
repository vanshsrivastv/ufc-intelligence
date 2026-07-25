import { Controller, Get, Param, Query } from "@nestjs/common";
import { EventsService } from "./events.service";
import { ListEventsDto } from "./dto/list-events.dto";

@Controller({ path: "events", version: "1" })
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(@Query() query: ListEventsDto) {
    return this.eventsService.list(query);
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.eventsService.getBySlug(slug);
  }
}
