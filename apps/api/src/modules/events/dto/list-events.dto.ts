import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export type EventSort = "date_asc" | "date_desc" | "recent";

export class ListEventsDto {
  @IsOptional()
  @IsIn(["UPCOMING", "LIVE", "COMPLETED"])
  status?: "UPCOMING" | "LIVE" | "COMPLETED";

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["date_asc", "date_desc", "recent"])
  sort?: EventSort = "date_asc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}
