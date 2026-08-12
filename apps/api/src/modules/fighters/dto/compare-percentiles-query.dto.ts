import { IsNotEmpty, IsString } from "class-validator";

export class ComparePercentilesQueryDto {
  @IsNotEmpty()
  @IsString()
  fighterA!: string;

  @IsNotEmpty()
  @IsString()
  fighterB!: string;
}
