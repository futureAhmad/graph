import type { ExecutiveDashboardResponse, GraphResponse, GraphStatistics, SearchResultItem } from "@/shared";
import { apiClient } from "@/lib/api";

export function getGraphStatistics() {
  return apiClient<GraphStatistics>("/graph/statistics");
}

export function getExecutiveDashboard() {
  return apiClient<ExecutiveDashboardResponse>("/graph/executive-dashboard");
}

export function listServices() {
  return apiClient<SearchResultItem[]>("/service");
}

export function listFunctions() {
  return apiClient<SearchResultItem[]>("/service/functions");
}

export function listServicesByFunction(functionId: string) {
  return apiClient<SearchResultItem[]>(`/service/functions/${encodeURIComponent(functionId)}/services`);
}

export function listApplications() {
  return apiClient<SearchResultItem[]>("/service/applications");
}

export function listIntegrations() {
  return apiClient<SearchResultItem[]>("/service/integrations");
}

export function getServiceDependencies(serviceName: string) {
  return apiClient<GraphResponse>(`/service/${encodeURIComponent(serviceName)}/dependencies`);
}

export function getNodeNeighbors(entityKey: string) {
  return apiClient<GraphResponse>(`/graph/node/${entityKey}/neighbors`);
}
