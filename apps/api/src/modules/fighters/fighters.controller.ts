import { Controller, Get, Param, Query } from "@nestjs/common";
import { FightersService } from "./fighters.service";
import { ListFightersDto } from "./dto/list-fighters.dto";

@Controller({ path: "fighters", version: "1" })
export class FightersController {
  constructor(private readonly fightersService: FightersService) {}

  @Get()
  list(@Query() query: ListFightersDto) {
    return this.fightersService.list(query);
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.fightersService.getBySlug(slug);
  }
}
