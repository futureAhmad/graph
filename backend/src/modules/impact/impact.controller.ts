import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ImpactQueryDto } from "./dto/impact-query.dto";
import { ImpactService } from "./impact.service";

@ApiTags("impact")
@Controller("impact")
export class ImpactController {
  constructor(private readonly impactService: ImpactService) {}

  @Get("app")
  listApplications(@Query() query: ImpactQueryDto) {
    return this.impactService.listApplications(query.datasetId);
  }

  @Get("integ")
  listIntegrations(@Query() query: ImpactQueryDto) {
    return this.impactService.listIntegrations(query.datasetId);
  }

  @Get("app/:name")
  analyzeApplication(@Param("name") name: string, @Query() query: ImpactQueryDto) {
    return this.impactService.analyzeApplication(name, query.datasetId);
  }

  @Get("integ/:name")
  analyzeIntegration(@Param("name") name: string, @Query() query: ImpactQueryDto) {
    return this.impactService.analyzeIntegration(name, query.datasetId);
  }
}
