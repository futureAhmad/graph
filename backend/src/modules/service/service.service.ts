import { CANONICAL_NODE_TYPES } from "../../shared";
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

  listFunctions(datasetId: string) {
    return this.graphRepository.listByType(CANONICAL_NODE_TYPES.FUNCTION, datasetId);
  }

  listServicesByFunction(functionId: number, datasetId: string) {
    return this.graphRepository.listServicesByFunction(functionId, datasetId);
  }

  listApplications(datasetId: string) {
    return this.graphRepository.listByType(CANONICAL_NODE_TYPES.APPLICATION, datasetId);
  }

  listIntegrations(datasetId: string) {
    return this.graphRepository.listByType(CANONICAL_NODE_TYPES.INTEGRATION, datasetId);
  }
}
