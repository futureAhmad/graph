"use client";

import { useCallback, useEffect, useState } from "react";
import type { GraphNode, GraphResponse, SearchResultItem } from "@/shared";
import { Network, Play } from "lucide-react";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { Button } from "@/components/ui/button";
import { CommandSelect } from "@/components/ui/command";
import { JsonObjectView } from "@/components/ui/json-object-view";
import { Panel } from "@/components/ui/panel";
import {
  getServiceDependencies,
  listFunctions,
  listServicesByFunction
} from "@/features/graph/graph.api";
import { colorForType } from "./node-colors";

export function ServiceExplorer() {
  const [functions, setFunctions] = useState<SearchResultItem[]>([]);
  const [services, setServices] = useState<SearchResultItem[]>([]);
  const [functionId, setFunctionId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canAnalyze = Boolean(serviceName.trim());

  const loadGraph = useCallback(async () => {
    if (!serviceName.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedNode(null);
    try {
      const result = await getServiceDependencies(serviceName);
      setGraph(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load graph.");
    } finally {
      setLoading(false);
    }
  }, [serviceName]);

  useEffect(() => {
    async function loadOptions() {
      setError(null);
      try {
        const functionResult = await listFunctions();
        setFunctions(functionResult);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load explorer options.");
      }
    }

    void loadOptions();
  }, []);

  useEffect(() => {
    async function loadFunctionServices() {
      if (!functionId) {
        setServices([]);
        setServiceName("");
        return;
      }

      setError(null);
      try {
        const result = await listServicesByFunction(functionId);
        setServices(result);
        setServiceName("");
        setGraph(null);
        setSelectedNode(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load services for selected function.");
      }
    }

    void loadFunctionServices();
  }, [functionId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Service Dependency Map</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select a function first, then choose one related service.</p>
        </div>
        <div className="grid gap-2 lg:grid-cols-[minmax(0,360px)_minmax(0,420px)_auto]">
          <CommandSelect
            options={functions.map((item) => ({ label: item.name, value: item.entityKey.replace("Function:", "") }))}
            value={functionId}
            onValueChange={setFunctionId}
            placeholder="Select function"
            searchPlaceholder="Search functions..."
            emptyText="No functions found."
            showFullText
          />
          <CommandSelect
            options={services.map((service) => ({ label: service.name, value: service.name }))}
            value={serviceName}
            onValueChange={setServiceName}
            placeholder="Select service"
            searchPlaceholder="Search services..."
            emptyText="No services found."
            showFullText
          />
          <Button onClick={loadGraph} disabled={loading || !canAnalyze}>
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
        />
        <div className="max-h-[620px] space-y-5 overflow-y-auto pr-1 xl:sticky xl:top-20">
          <Panel>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/15 text-blue-300">
                <Network className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Selection Details</h2>
                <p className="text-sm text-muted-foreground">{serviceName || "No service selected"}</p>
              </div>
            </div>
            <ServiceCriticalBadge graph={graph} />
            <ServiceThirdParties graph={graph} />
          </Panel>
          <Panel className="space-y-4">
            <h2 className="font-semibold">Selected Node</h2>
            {selectedNode ? (
              <>
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: colorForType(selectedNode.type) }}
                    />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{nodeTypeLabel(selectedNode.type)}</span>
                  </div>
                  <div className="mt-3 break-words text-lg font-semibold">{capitalizeFirst(selectedNode.name)}</div>
                </div>
                <NodeProperties properties={selectedNode.properties} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Click a graph node to inspect it.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ServiceCriticalBadge({ graph }: { graph: GraphResponse | null }) {
  const serviceNode = graph?.nodes.find((node) => node.id === graph.rootNodeId || node.type === "Service");
  const isCritical = serviceNode?.properties?.isCritical === true;
  

  return (
    <div
      className={
        isCritical
          ? "mt-5 inline-flex rounded-md border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-sm font-semibold text-red-100"
          : "mt-5 inline-flex rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-100"
      }
    >
      {isCritical ? "Critical service" : "Non-critical service"}
    </div>
  );
}

function ServiceThirdParties({ graph }: { graph: GraphResponse | null }) {
  const serviceNode = graph?.nodes.find((node) => node.id === graph.rootNodeId || node.type === "Service");
  const thirdParties = toStringArray(serviceNode?.properties?.thirdParties);

  if (thirdParties.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 text-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Third Parties</div>
      <div className="mt-2">
        <JsonObjectView value={{ thirdParties, count: thirdParties.length }} />
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
        .filter(([key]) => key !== "criticalHardwareSpecs" && key !== "thirdParties")
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

function capitalizeFirst(value: string) {
  return value.trim().toUpperCase();
}
