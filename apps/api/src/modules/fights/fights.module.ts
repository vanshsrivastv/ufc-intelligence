import { Module } from "@nestjs/common";
import { FightsController } from "./fights.controller";
import { FightsService } from "./fights.service";

@Module({
  controllers: [FightsController],
  providers: [FightsService],
  exports: [FightsService],
})
export class FightsModule {}
