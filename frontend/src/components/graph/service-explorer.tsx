"use client";

import { useCallback, useEffect, useState } from "react";
import type { GraphEdge, GraphNode, GraphResponse, SearchResultItem } from "@service-dependency/shared";
import { Network, Play } from "lucide-react";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { Button } from "@/components/ui/button";
import { CommandSelect } from "@/components/ui/command";
import { Panel } from "@/components/ui/panel";
import { apiClient } from "@/lib/api";
import { colorForType } from "./node-colors";

export function ServiceExplorer() {
  const [services, setServices] = useState<SearchResultItem[]>([]);
  const [serviceName, setServiceName] = useState("");
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient<GraphResponse>(`/service/${encodeURIComponent(serviceName)}/dependencies`);
      setGraph(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load graph.");
    } finally {
      setLoading(false);
    }
  }, [serviceName]);

  useEffect(() => {
    async function loadServices() {
      setError(null);
      try {
        const result = await apiClient<SearchResultItem[]>("/service");
        setServices(result);
        setServiceName((current) => current || result[0]?.name || "");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load services.");
      }
    }

    void loadServices();
  }, []);

  useEffect(() => {
    if (serviceName) {
      void loadGraph();
    }
  }, [loadGraph, serviceName]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Service Dependency Map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select one service and generate its dependency tree.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,280px)_auto]">
          <CommandSelect
            options={services.map((service) => ({ label: service.name, value: service.name }))}
            value={serviceName}
            onValueChange={setServiceName}
            placeholder="Select service"
            searchPlaceholder="Search services..."
            emptyText="No services found."
          />
          <Button onClick={loadGraph} disabled={loading || !serviceName.trim()}>
            <Play className="h-4 w-4" />
            {loading ? "Loading" : "Analyze"}
          </Button>
        </div>
      </div>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p> : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_310px]">
        <GraphCanvas
          graph={graph ?? undefined}
          height={620}
          title="Dependency Flow"
          onSelectedNodeChange={setSelectedNode}
          onSelectedEdgeChange={setSelectedEdge}
        />
        <div className="max-h-[620px] space-y-5 overflow-y-auto pr-1 xl:sticky xl:top-20">
          <Panel>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/15 text-blue-300">
                <Network className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Service Details</h2>
                <p className="text-sm text-muted-foreground">{serviceName}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Nodes" value={graph?.nodes.length ?? 0} />
              <Metric label="Edges" value={graph?.edges.length ?? 0} />
            </div>
          </Panel>
          <Panel className="space-y-4">
            <h2 className="font-semibold">{selectedEdge ? "Selected Relationship" : "Selected Node"}</h2>
            {selectedEdge ? (
              <>
                <div className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-cyan-100">Relationship Type</div>
                  <div className="mt-2 text-lg font-semibold text-cyan-50">{selectedEdge.type}</div>
                  <div className="mt-1 text-xs text-cyan-100">{relationshipDescription(selectedEdge.type)}</div>
                </div>
                <Detail label="From" value={nodeName(graph, selectedEdge.source)} />
                <Detail label="To" value={nodeName(graph, selectedEdge.target)} />
                <Detail label="Edge ID" value={selectedEdge.id} />
              </>
            ) : selectedNode ? (
              <>
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: colorForType(selectedNode.type) }}
                    />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{nodeTypeLabel(selectedNode.type)}</span>
                  </div>
                  <div className="mt-3 break-words text-lg font-semibold">{selectedNode.name}</div>
                </div>
                <Detail label="Dataset" value={selectedNode.datasetId} />
                <Detail label="Entity Key" value={selectedNode.entityKey} />
                <NodeProperties properties={selectedNode.properties} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Click a graph node or relationship edge to inspect it.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-foreground">{value}</div>
    </div>
  );
}

function NodeProperties({ properties }: { properties?: Record<string, unknown> }) {
  if (!properties || Object.keys(properties).length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {Object.entries(properties)
        .filter(([key]) => key !== "criticalHardwareSpecs")
        .map(([key, value]) => (
          <PropertyBlock
            key={key}
            propertyKey={key}
            value={value}
            criticalHardwareSpecs={toStringArray(properties.criticalHardwareSpecs)}
          />
        ))}
    </div>
  );
}

function PropertyBlock({
  propertyKey,
  value,
  criticalHardwareSpecs
}: {
  propertyKey: string;
  value: unknown;
  criticalHardwareSpecs: string[];
}) {
  const label = humanizeKey(propertyKey);
  if (Array.isArray(value)) {
    if (propertyKey === "hardwareSpecs") {
      return <HardwareSpecTable label={label} items={value.map(String)} criticalItems={criticalHardwareSpecs} />;
    }

    return (
      <div className="text-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {value.length > 0 ? (
            value.map((item) => (
              <span key={String(item)} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-foreground">
                {String(item)}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </div>
      </div>
    );
  }

  return <Detail label={label} value={formatPropertyValue(value)} />;
}

function HardwareSpecTable({ label, items, criticalItems }: { label: string; items: string[]; criticalItems: string[] }) {
  const criticalSet = new Set(criticalItems);

  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 overflow-hidden rounded-md border border-white/10">
        <div className="grid grid-cols-[104px_1fr] border-b border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span>Type</span>
          <span>Specification</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {items.length > 0 ? (
            items.map((item) => {
              const spec = splitHardwareSpec(item);
              const critical = criticalSet.has(item);
              return (
                <div
                  key={item}
                  className={
                    critical
                      ? "grid grid-cols-[104px_1fr] gap-2 border-b border-red-400/20 bg-red-500/[0.08] px-3 py-2 shadow-[inset_3px_0_0_rgba(248,113,113,0.65)] last:border-b-0"
                      : "grid grid-cols-[104px_1fr] gap-2 border-b border-white/10 px-3 py-2 last:border-b-0"
                  }
                >
                  <span
                    className={
                      critical
                        ? "rounded bg-red-400/15 px-1.5 py-0.5 text-xs font-semibold text-red-100"
                        : "rounded bg-sky-400/10 px-1.5 py-0.5 text-xs font-semibold text-sky-200"
                    }
                  >
                    {spec.category}
                  </span>
                  <span className={critical ? "break-words text-xs font-medium leading-5 text-red-50" : "break-words text-xs leading-5 text-foreground"}>
                    {spec.name}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">None</div>
          )}
        </div>
      </div>
    </div>
  );
}

function splitHardwareSpec(item: string) {
  const separatorIndex = item.indexOf(":");
  if (separatorIndex === -1) {
    return { category: "other", name: item };
  }
  return {
    category: item.slice(0, separatorIndex).replaceAll("_", " "),
    name: item.slice(separatorIndex + 1).trim()
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function humanizeKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatPropertyValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "None";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === null || value === undefined || value === "") {
    return "None";
  }
  return String(value);
}

function nodeTypeLabel(type: string) {
  if (type === "DirectChannel") {
    return "Direct Channel";
  }
  return type;
}

function nodeName(graph: GraphResponse | null, nodeId: string) {
  return graph?.nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}

function relationshipDescription(type: string) {
  if (type === "AVAILABLE_ON") {
    return "Service is available on this direct channel.";
  }
  if (type === "DEPENDS_ON") {
    return "Parent dependency requires the child dependency in this service path.";
  }
  return "Relationship between dependency nodes.";
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
