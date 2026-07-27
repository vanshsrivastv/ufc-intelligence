import { Controller, Get, Query } from "@nestjs/common";
import { PredictionsService } from "./predictions.service";
import { MatchupQueryDto } from "./dto/matchup-query.dto";

@Controller({ path: "predictions", version: "1" })
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get("matchup")
  getMatchup(@Query() query: MatchupQueryDto) {
    return this.predictionsService.getMatchup(query.fighterA, query.fighterB);
  }
}