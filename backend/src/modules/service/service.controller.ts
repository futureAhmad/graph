import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DatasetQueryDto } from "../../common/dto/dataset-query.dto";
import { ServiceDependencyService } from "./service.service";

@ApiTags("service")
@Controller("service")
export class ServiceController {
  constructor(private readonly serviceDependencyService: ServiceDependencyService) {}

  @Get()
  listServices(@Query() query: DatasetQueryDto) {
    return this.serviceDependencyService.listServices(query.datasetId);
  }

  @Get(":name/dependencies")
  getDependencies(@Param("name") name: string, @Query() query: DatasetQueryDto) {
    return this.serviceDependencyService.getDependencies(name, query.datasetId);
  }
}
