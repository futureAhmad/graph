import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DatasetQueryDto } from "../../common/dto/dataset-query.dto";
import { GraphService } from "./graph.service";

@ApiTags("graph")
@Controller("graph")
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get("statistics")
  getStatistics(@Query() query: DatasetQueryDto) {
    return this.graphService.getStatistics(query);
  }

  @Get("executive-dashboard")
  getExecutiveDashboard(@Query() query: DatasetQueryDto) {
    return this.graphService.getExecutiveDashboard(query);
  }

  @Get("node/:entityKey/neighbors")
  getNeighbors(@Param("entityKey") entityKey: string) {
    return this.graphService.getNeighbors(entityKey);
  }
}
