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
  criticalServices: {
    critical: number;
    nonCritical: number;
  };
  thirdPartyExposure: {
    totalThirdParties: number;
    applicationsWithThirdParty: number;
    applicationsWithoutThirdParty: number;
  };
  hardwareCriticality: {
    critical: number;
    nonCritical: number;
    byCategory: Array<{
      category: string;
      critical: number;
      nonCritical: number;
    }>;
  };
  topThirdParties: Array<{
    name: string;
    applications: number;
    services: number;
  }>;
  topCriticalServices: Array<{
    name: string;
    channels: number;
    applications: number;
    integrations: number;
  }>;
  serviceRiskMap: Array<{
    name: string;
    channels: number;
    applications: number;
    integrations: number;
    isCritical: boolean;
  }>;
  functionPortfolio: Array<{
    name: string;
    services: number;
    criticalServices: number;
    applications: number;
    integrations: number;
    thirdParties: number;
  }>;
  channelPortfolio: Array<{
    name: string;
    services: number;
    applications: number;
    integrations: number;
    paths: number;
  }>;
  applicationComplexity: Array<{
    bucket: string;
    applications: number;
  }>;
  thirdPartyByFunction: Array<{
    name: string;
    thirdParties: number;
    applications: number;
  }>;
}

export type ExecutiveSeverity = "Information" | "Attention" | "High" | "Critical";

export interface ExecutiveMetric {
  value: number;
  percentage?: number;
  interpretation: string;
  calculation: string;
  severity?: ExecutiveSeverity;
}

export interface ExecutiveDashboardSummary {
  totalServices: ExecutiveMetric;
  totalFunctions: ExecutiveMetric;
  totalApplications: ExecutiveMetric;
  totalIntegrations: ExecutiveMetric;
  totalThirdParties: ExecutiveMetric;
  criticalServices: ExecutiveMetric;
  thirdPartyDependentServices: ExecutiveMetric;
  criticalHardwareExposedServices: ExecutiveMetric;
  averageApplicationsPerService: ExecutiveMetric;
  averageIntegrationsPerService: ExecutiveMetric;
}

export interface ExecutiveFunctionPortfolio {
  name: string;
  services: number;
  criticalServices: number;
  portfolioPercentage: number;
  criticalityRate: number;
}

export interface ExecutiveThirdPartyExposure {
  name: string;
  services: number;
  criticalServices: number;
  applications: number;
  functions: number;
  serviceExposurePercentage: number;
  criticalityRate: number;
  flags: string[];
  riskClass: "High exposure / high criticality" | "High exposure / lower criticality" | "Lower exposure / high criticality" | "Lower exposure / lower criticality";
}

export interface ExecutiveApplicationImpact {
  name: string;
  services: number;
  criticalServices: number;
  functions: number;
  directChannels: number;
  integrations: number;
  thirdParties: number;
  hardwareSpecs: number;
  indicators: string[];
}

export interface ExecutiveIntegrationImpact {
  name: string;
  services: number;
  criticalServices: number;
  applications: number;
  functions: number;
  channels: number;
  criticalHardwareSpecs: number;
  hardwareSpecs: number;
}

export interface ExecutiveFunctionComplexity {
  name: string;
  averageApplicationsPerService: number;
  averageIntegrationsPerService: number;
  averageThirdPartiesPerService: number;
  averageDependencyPathsPerService: number;
}

export interface ExecutiveExposureSummary {
  category: string;
  services: number;
  percentage: number;
  calculation: string;
}

export interface ExecutiveInsight {
  severity: ExecutiveSeverity;
  title: string;
  detail: string;
}

export interface ExecutiveDashboardThresholds {
  enterpriseDependencyServiceShare: number;
  highCriticalityRate: number;
  crossFunctionCount: number;
  functionConcentratedMaxFunctions: number;
  highExposureServices: number;
  highCriticalServices: number;
}

export interface ExecutiveDashboardResponse {
  summary: ExecutiveDashboardSummary;
  servicesByFunction: ExecutiveFunctionPortfolio[];
  functionCriticality: ExecutiveFunctionPortfolio[];
  topThirdParties: ExecutiveThirdPartyExposure[];
  thirdPartyRisk: ExecutiveThirdPartyExposure[];
  topApplications: ExecutiveApplicationImpact[];
  topIntegrations: ExecutiveIntegrationImpact[];
  complexityByFunction: ExecutiveFunctionComplexity[];
  exposureSummary: ExecutiveExposureSummary[];
  insights: ExecutiveInsight[];
  thresholds: ExecutiveDashboardThresholds;
  generatedAt: string;
}
