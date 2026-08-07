import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export type FighterSort = "documented_first" | "name_asc" | "recent" | "oldest";
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

  // ~1,873 of 4,520 fighters have only an aggregate win/loss record from
  // fighters.csv with no fight-by-fight rows behind it (lastFightDate is
  // never set for these - see schema.prisma's comment on that field).
  // Real people, not junk data, but browsing 226 pages of them
  // interleaved alphabetically with fully-documented fighters was the
  // single biggest usability problem on this page. Excludes them
  // entirely rather than just deprioritizing, for people who specifically
  // want a clean, fully-documented roster.
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  documentedOnly?: boolean;

  @IsOptional()
  @IsIn(["documented_first", "name_asc", "recent", "oldest"])
  sort?: FighterSort = "documented_first";

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
