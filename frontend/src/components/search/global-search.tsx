"use client";

import { useState } from "react";
import type { GraphResponse, SearchResultItem } from "@service-dependency/shared";
import { Search } from "lucide-react";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { apiClient } from "@/lib/api";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setError(null);
    try {
      const result = await apiClient<SearchResultItem[]>(`/search?q=${encodeURIComponent(query)}`);
      setResults(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    }
  }

  async function openNode(entityKey: string) {
    setError(null);
    try {
      const result = await apiClient<GraphResponse>(`/graph/node/${entityKey}/neighbors`);
      setGraph(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open node.");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Panel className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Search className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-semibold">Global Search</h1>
        </div>
        <div className="flex gap-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} />
          <Button onClick={search}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p> : null}
        <div className="space-y-2">
          {results.map((result) => (
            <button
              key={result.entityKey}
              className="w-full rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.08]"
              onClick={() => openNode(result.entityKey)}
            >
              <div className="font-medium">{result.name}</div>
              <div className="text-sm text-muted-foreground">{result.type}</div>
            </button>
          ))}
        </div>
      </Panel>
      <GraphCanvas graph={graph ?? undefined} height={640} title="Search Context" />
    </div>
  );
}
