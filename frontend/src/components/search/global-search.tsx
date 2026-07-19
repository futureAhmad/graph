"use client";

import { useState } from "react";
import type { GraphResponse, SearchResultItem } from "@/shared";
import { Search } from "lucide-react";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { getNodeNeighbors, getServiceDependencies } from "@/features/graph/graph.api";
import { searchEntities } from "@/features/search/search.api";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search() {
    const trimmedQuery = query.trim();
    setError(null);
    setSearched(true);
    setGraph(null);
    if (!trimmedQuery) {
      setResults([]);
      setError("Enter a service, application, integration, channel, third party, or hardware spec name.");
      return;
    }

    try {
      const result = await searchEntities(trimmedQuery);
      setResults(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    }
  }

  async function openResult(result: SearchResultItem) {
    setError(null);
    try {
      const graph = result.serviceName
        ? await getServiceDependencies(result.serviceName)
        : await getNodeNeighbors(result.entityKey);
      setGraph(result.contextKey ? graphForContext(graph, result.contextKey) : graph);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open node.");
    }
  }

  return (
    <div className="grid min-h-0 gap-5 xl:grid-cols-[360px_1fr]">
      <Panel className="flex max-h-[calc(100vh-7rem)] min-h-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Search className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Global Search</h1>
            <p className="mt-1 text-sm text-muted-foreground">Search services, applications, integrations, channels, third parties, or hardware specs.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void search();
              }
            }}
            placeholder="Example: T24, CRM, Mobile App, Vendor 01"
          />
          <Button onClick={search}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p> : null}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {results.length > 0 ? (
            results.map((result) => (
              <button
                key={result.contextKey ?? result.entityKey}
                className="w-full rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.08]"
                onClick={() => openResult(result)}
              >
                <div className="font-medium">{result.name}</div>
                <div className="text-sm text-muted-foreground">{result.type}</div>
                {result.contextLabel ? (
                  <div className="mt-1 text-xs text-sky-200">{result.contextLabel}</div>
                ) : null}
              </button>
            ))
          ) : (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {searched
                ? "No matching result found. Try a shorter name or search another entity type."
                : "Search results will appear here. Select a result to load its graph."}
            </div>
          )}
        </div>
      </Panel>
      <GraphCanvas graph={graph ?? undefined} height={640} title="Search Context" />
    </div>
  );
}

function graphForContext(graph: GraphResponse, contextKey: string): GraphResponse {
  const parts = contextKey.split(":");
  const type = parts[0];
  const id = parts[1];
  const serviceId = valueAfter(parts, "Service");
  const directChannelId = valueAfter(parts, "DirectChannel");
  const applicationId = valueAfter(parts, "Application");

  if (!serviceId || type === "Service") {
    return graph;
  }

  const rootId = `Service:${serviceId}`;
  const directChannelNodeId = directChannelId ? `${rootId}/DirectChannel:${directChannelId}` : undefined;
  const applicationNodeId = directChannelNodeId && applicationId ? `${directChannelNodeId}/Application:${applicationId}` : undefined;
  const exactNodeId =
    type === "DirectChannel"
      ? directChannelNodeId
      : type === "Application" || type === "ThirdParty"
        ? applicationNodeId
        : type === "Integration" && directChannelNodeId && applicationId
          ? `${directChannelNodeId}/Integration:${id}`
          : undefined;
  const keepIds = new Set<string>([rootId]);

  if (directChannelNodeId) {
    keepIds.add(directChannelNodeId);
  }
  if (applicationNodeId) {
    keepIds.add(applicationNodeId);
  }
  if (exactNodeId) {
    keepIds.add(exactNodeId);
  }
  if (type === "DirectChannel" && directChannelNodeId) {
    addDescendants(graph, directChannelNodeId, keepIds);
  }
  if (type === "Application" && applicationNodeId) {
    addDescendants(graph, applicationNodeId, keepIds);
  }

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => keepIds.has(node.id)),
    edges: graph.edges.filter((edge) => keepIds.has(edge.source) && keepIds.has(edge.target)),
    rootNodeId: rootId
  };
}

function addDescendants(graph: GraphResponse, nodeId: string, keepIds: Set<string>) {
  const children = graph.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);
  for (const childId of children) {
    if (keepIds.has(childId)) {
      continue;
    }
    keepIds.add(childId);
    addDescendants(graph, childId, keepIds);
  }
}

function valueAfter(parts: string[], key: string) {
  const index = parts.indexOf(key);
  return index === -1 ? undefined : parts[index + 1];
}
