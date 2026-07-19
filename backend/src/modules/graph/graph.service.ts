import { Injectable } from "@nestjs/common";
import { DatasetQueryDto } from "../../common/dto/dataset-query.dto";
import { GraphRepository } from "./graph.repository";

@Injectable()
export class GraphService {
  constructor(private readonly graphRepository: GraphRepository) {}

  getStatistics(query: DatasetQueryDto) {
    return this.graphRepository.getStatistics(query.datasetId);
  }

  getExecutiveDashboard(query: DatasetQueryDto) {
    return this.graphRepository.getExecutiveDashboard(query.datasetId);
  }

  getNeighbors(entityKey: string) {
    return this.graphRepository.getNeighbors(entityKey);
  }
}
