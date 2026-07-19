import type { SearchResultItem } from "@/shared";
import { apiClient } from "@/lib/api";

export function searchEntities(query: string) {
  return apiClient<SearchResultItem[]>(`/search?q=${encodeURIComponent(query)}`);
}
