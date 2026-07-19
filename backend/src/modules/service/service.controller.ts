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

  @Get("functions")
  listFunctions(@Query() query: DatasetQueryDto) {
    return this.serviceDependencyService.listFunctions(query.datasetId);
  }

  @Get("functions/:functionId/services")
  listServicesByFunction(@Param("functionId") functionId: string, @Query() query: DatasetQueryDto) {
    return this.serviceDependencyService.listServicesByFunction(Number(functionId), query.datasetId);
  }

  @Get("applications")
  listApplications(@Query() query: DatasetQueryDto) {
    return this.serviceDependencyService.listApplications(query.datasetId);
  }

  @Get("integrations")
  listIntegrations(@Query() query: DatasetQueryDto) {
    return this.serviceDependencyService.listIntegrations(query.datasetId);
  }

  @Get(":name/dependencies")
  getDependencies(@Param("name") name: string, @Query() query: DatasetQueryDto) {
    return this.serviceDependencyService.getDependencies(name, query.datasetId);
  }
}
