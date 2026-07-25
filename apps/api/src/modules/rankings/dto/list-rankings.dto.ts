import { IsOptional, IsString } from "class-validator";

export class ListRankingsDto {
  @IsOptional()
  @IsString()
  weightClass?: string;
}