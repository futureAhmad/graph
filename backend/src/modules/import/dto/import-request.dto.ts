import { DEFAULT_DATASET_ID } from "../../../shared";
import { IsOptional, IsString } from "class-validator";

export class ImportRequestDto {
  @IsOptional()
  @IsString()
  datasetId: string = DEFAULT_DATASET_ID;

  @IsOptional()
  @IsString()
  sourceName?: string;
}
