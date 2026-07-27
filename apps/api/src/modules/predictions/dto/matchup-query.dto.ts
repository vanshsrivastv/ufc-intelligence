import { IsNotEmpty, IsString } from "class-validator";

export class MatchupQueryDto {
  @IsNotEmpty()
  @IsString()
  fighterA!: string;

  @IsNotEmpty()
  @IsString()
  fighterB!: string;
}