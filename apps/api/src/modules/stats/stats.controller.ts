import { Controller, Get } from "@nestjs/common";
import { StatsService } from "./stats.service";

@Controller({ path: "stats", version: "1" })
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get("overview")
  getOverview() {
    return this.statsService.getOverview();
  }

  @Get("champions")
  getChampions() {
    return this.statsService.getChampions();
  }

  @Get("leaderboards")
  getLeaderboards() {
    return this.statsService.getLeaderboards();
  }
}