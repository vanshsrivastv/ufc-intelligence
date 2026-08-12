import { Controller, Get, Param, Query } from "@nestjs/common";
import { FightersService } from "./fighters.service";
import { ListFightersDto } from "./dto/list-fighters.dto";
import { ComparePercentilesQueryDto } from "./dto/compare-percentiles-query.dto";

@Controller({ path: "fighters", version: "1" })
export class FightersController {
  constructor(private readonly fightersService: FightersService) {}

  @Get()
  list(@Query() query: ListFightersDto) {
    return this.fightersService.list(query);
  }

  // Registered before the :slug route below - a static path has to come
  // first, or :slug would greedily match "compare-percentiles" as a
  // literal fighter slug and this would never be reached.
  @Get("compare-percentiles")
  getComparePercentiles(@Query() query: ComparePercentilesQueryDto) {
    return this.fightersService.getComparePercentiles(query.fighterA, query.fighterB);
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.fightersService.getBySlug(slug);
  }
}
