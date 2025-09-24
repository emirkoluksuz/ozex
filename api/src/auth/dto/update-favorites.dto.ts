import { IsArray, IsString, ArrayMaxSize, ArrayUnique, MaxLength } from "class-validator";

export class UpdateFavoritesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  symbols!: string[];
}
