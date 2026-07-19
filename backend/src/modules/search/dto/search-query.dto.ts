import { DEFAULT_DATASET_ID } from "../../../shared";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  q: string = "";

  @IsOptional()
  @IsString()
  datasetId: string = DEFAULT_DATASET_ID;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
