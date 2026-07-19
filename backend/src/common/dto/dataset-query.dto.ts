import { DEFAULT_DATASET_ID } from "../../shared";
import { IsOptional, IsString } from "class-validator";

export class DatasetQueryDto {
  @IsOptional()
  @IsString()
  datasetId: string = DEFAULT_DATASET_ID;
}
