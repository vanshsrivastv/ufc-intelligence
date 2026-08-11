import { Controller, Get, Query } from "@nestjs/common";
import { RankingsService } from "./rankings.service";
import { ListRankingsDto } from "./dto/list-rankings.dto";

@Controller({ path: "rankings", version: "1" })
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get("weight-classes")
  listWeightClasses() {
    return this.rankingsService.listWeightClasses();
  }

  @Get()
  list(@Query() query: ListRankingsDto) {
    return this.rankingsService.list(query);
  }

  @Get("elo")
  listByElo(@Query() query: ListRankingsDto) {
    return this.rankingsService.listByElo(query);
  }
}