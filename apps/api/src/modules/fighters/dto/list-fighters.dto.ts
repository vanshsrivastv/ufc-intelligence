import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export type FighterSort = "name_asc" | "recent" | "oldest";
export type FighterGender = "men" | "women";
export type FighterActivity = "active" | "inactive";

export class ListFightersDto {
  @IsOptional()
  @IsString()
  weightClass?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["men", "women"])
  gender?: FighterGender;

  @IsOptional()
  @IsIn(["active", "inactive"])
  activity?: FighterActivity;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  championOnly?: boolean;

  @IsOptional()
  @IsIn(["name_asc", "recent", "oldest"])
  sort?: FighterSort = "name_asc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
