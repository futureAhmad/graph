import type { ImpactResponse, SearchResultItem } from "@/shared";
import { apiClient } from "@/lib/api";

export type ImpactMode = "app" | "integ";

export function getImpactOptions(mode: ImpactMode) {
  return apiClient<SearchResultItem[]>(`/impact/${mode}`);
}

export function getImpact(mode: ImpactMode, name: string) {
  return apiClient<ImpactResponse>(`/impact/${mode}/${encodeURIComponent(name)}`);
}
