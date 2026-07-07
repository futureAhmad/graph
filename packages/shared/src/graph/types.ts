export type ImpactLevel = "Low" | "Medium" | "High" | "Critical";

export interface GraphNode {
  id: string;
  entityKey: string;
  type: string;
  label: string;
  name: string;
  normalizedName: string;
  datasetId: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  properties?: Record<string, unknown>;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootNodeId?: string;
}

export interface DependencyTreeNode {
  id: string;
  name: string;
  type: string;
  children: DependencyTreeNode[];
}

export interface ImpactResponse {
  source: {
    type: string;
    name: string;
  };
  impactLevel: ImpactLevel;
  affectedServices: GraphNode[];
  affectedDirectChannels: GraphNode[];
  tree: DependencyTreeNode[];
  graph: GraphResponse;
}

export interface GraphStatistics {
  totalNodes: number;
  totalRelationships: number;
  nodesByType: Record<string, number>;
}
