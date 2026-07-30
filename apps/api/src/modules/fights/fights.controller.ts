import { Controller, Get, Param } from "@nestjs/common";
import { FightsService } from "./fights.service";

@Controller("fights")
export class FightsController {
  constructor(private readonly fightsService: FightsService) {}

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.fightsService.getById(id);
  }
}
