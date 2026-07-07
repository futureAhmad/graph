import { CANONICAL_NODE_TYPES } from "@service-dependency/shared";
import { Injectable } from "@nestjs/common";
import { GraphRepository } from "../graph/graph.repository";

@Injectable()
export class ServiceDependencyService {
  constructor(private readonly graphRepository: GraphRepository) {}

  getDependencies(name: string, datasetId: string) {
    return this.graphRepository.getServiceDependencies(name, datasetId);
  }

  listServices(datasetId: string) {
    return this.graphRepository.listByType(CANONICAL_NODE_TYPES.SERVICE, datasetId);
  }
}
