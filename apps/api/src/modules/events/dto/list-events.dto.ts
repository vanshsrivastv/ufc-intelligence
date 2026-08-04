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

  // Intentionally no default here: the service picks one based on which
  // status tab is active, which it can only do while "unset" is still
  // distinguishable from an explicitly chosen date_asc.
  @IsOptional()
  @IsIn(["date_asc", "date_desc", "recent"])
  sort?: EventSort;

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
