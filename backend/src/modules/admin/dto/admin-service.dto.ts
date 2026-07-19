import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class EntityInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  name!: string;
}

class HardwareSpecDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsIn(["application", "integration"])
  sourceType!: "application" | "integration";

  @IsBoolean()
  isCritical!: boolean;
}

export class CreateServicePathDto {
  @IsOptional()
  @IsString()
  functionName?: string;

  @ValidateNested()
  @Type(() => EntityInputDto)
  service!: EntityInputDto;

  @IsBoolean()
  serviceIsCritical!: boolean;

  @ValidateNested()
  @Type(() => EntityInputDto)
  directChannel!: EntityInputDto;

  @ValidateNested()
  @Type(() => EntityInputDto)
  application!: EntityInputDto;

  @ValidateNested()
  @Type(() => EntityInputDto)
  integration!: EntityInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HardwareSpecDto)
  hardwareSpec?: HardwareSpecDto;

  @IsOptional()
  @IsString()
  thirdPartyName?: string;
}
