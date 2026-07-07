import { Injectable, OnApplicationBootstrap, Logger } from "@nestjs/common";
import { DatasetQueryDto } from "../../common/dto/dataset-query.dto";
import { GraphRepository } from "./graph.repository";

@Injectable()
export class GraphService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GraphService.name);

  constructor(private readonly graphRepository: GraphRepository) {}

  onApplicationBootstrap(): void {
    void this.graphRepository
      .ensureSchema()
      .catch((error) => this.logger.warn(`SQL schema initialization skipped: ${(error as Error).message}`));
  }

  getStatistics(query: DatasetQueryDto) {
    return this.graphRepository.getStatistics(query.datasetId);
  }

  getNeighbors(entityKey: string) {
    return this.graphRepository.getNeighbors(entityKey);
  }
}
