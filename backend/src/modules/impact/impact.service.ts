import {
  CANONICAL_NODE_TYPES,
  DependencyTreeNode,
  GraphNode,
  GraphResponse,
  ImpactLevel,
  ImpactResponse
} from "../../shared";
import { Injectable } from "@nestjs/common";
import { GraphRepository } from "../graph/graph.repository";

@Injectable()
export class ImpactService {
  constructor(private readonly graphRepository: GraphRepository) {}

  async analyzeApplication(name: string, datasetId: string): Promise<ImpactResponse> {
    return this.analyze(CANONICAL_NODE_TYPES.APPLICATION, name, datasetId);
  }

  async analyzeIntegration(name: string, datasetId: string): Promise<ImpactResponse> {
    return this.analyze(CANONICAL_NODE_TYPES.INTEGRATION, name, datasetId);
  }

  listApplications(datasetId: string) {
    return this.graphRepository.listByType(CANONICAL_NODE_TYPES.APPLICATION, datasetId);
  }

  listIntegrations(datasetId: string) {
    return this.graphRepository.listByType(CANONICAL_NODE_TYPES.INTEGRATION, datasetId);
  }

  private async analyze(type: string, name: string, datasetId: string): Promise<ImpactResponse> {
    const graph = await this.graphRepository.getImpactGraph(type, name, datasetId);
    const affectedServices = uniqueNodes(graph.nodes.filter((node) => node.type === CANONICAL_NODE_TYPES.SERVICE));
    const affectedDirectChannels = uniqueNodes(
      graph.nodes.filter((node) => node.type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL)
    );

    return {
      source: { type, name },
      impactLevel: this.calculateImpactLevel(affectedServices.length, affectedDirectChannels.length),
      affectedServices,
      affectedDirectChannels,
      tree: this.buildDependencyTree(graph),
      graph
    };
  }

  private calculateImpactLevel(serviceCount: number, channelCount: number): ImpactLevel {
    const score = serviceCount * 2 + channelCount;
    if (score >= 30) {
      return "Critical";
    }
    if (score >= 12) {
      return "High";
    }
    if (score >= 4) {
      return "Medium";
    }
    return "Low";
  }

  private buildDependencyTree(graph: GraphResponse): DependencyTreeNode[] {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const childrenById = new Map<string, Set<string>>();

    for (const edge of graph.edges) {
      const parentId = graph.rootNodeId && edge.type === "DEPENDS_ON" ? edge.target : edge.source;
      const childId = graph.rootNodeId && edge.type === "DEPENDS_ON" ? edge.source : edge.target;
      const children = childrenById.get(parentId) ?? new Set<string>();
      children.add(childId);
      childrenById.set(parentId, children);
    }

    const roots = graph.rootNodeId
      ? graph.nodes.filter((node) => node.id === graph.rootNodeId)
      : graph.nodes.filter((node) => node.type === CANONICAL_NODE_TYPES.SERVICE);

    return roots.map((root) => this.toTreeNode(root, nodeById, childrenById, new Set<string>()));
  }

  private toTreeNode(
    node: GraphNode,
    nodeById: Map<string, GraphNode>,
    childrenById: Map<string, Set<string>>,
    visited: Set<string>
  ): DependencyTreeNode {
    const nextVisited = new Set(visited);
    nextVisited.add(node.id);

    const children = Array.from(childrenById.get(node.id) ?? [])
      .filter((childId) => !nextVisited.has(childId))
      .map((childId) => nodeById.get(childId))
      .filter((child): child is GraphNode => Boolean(child))
      .map((child) => this.toTreeNode(child, nodeById, childrenById, nextVisited));

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      children
    };
  }
}

function uniqueNodes(nodes: GraphNode[]): GraphNode[] {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}
