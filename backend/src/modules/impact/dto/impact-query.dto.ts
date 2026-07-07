import { DEFAULT_DATASET_ID } from "@service-dependency/shared";
import { IsOptional, IsString } from "class-validator";

export class ImpactQueryDto {
  @IsOptional()
  @IsString()
  datasetId: string = DEFAULT_DATASET_ID;
}
