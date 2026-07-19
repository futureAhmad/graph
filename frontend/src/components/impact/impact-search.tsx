"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImpactResponse, SearchResultItem } from "@/shared";
import { AlertTriangle, Check, Copy, GitBranch } from "lucide-react";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { Button } from "@/components/ui/button";
import { CommandSelect } from "@/components/ui/command";
import { Panel } from "@/components/ui/panel";
import { getImpact, getImpactOptions, type ImpactMode } from "@/features/impact/impact.api";

const impactModeOptions = [
  { label: "Application", value: "app" },
  { label: "Integration", value: "integ" }
];

export function ImpactSearch() {
  const [mode, setMode] = useState<ImpactMode>("app");
  const [name, setName] = useState("");
  const [options, setOptions] = useState<SearchResultItem[]>([]);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setImpact(null);
    try {
      const result = await getImpact(mode, name);
      setImpact(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impact analysis failed.");
    } finally {
      setLoading(false);
    }
  }, [mode, name]);

  useEffect(() => {
    async function loadOptions() {
      setError(null);
        setImpact(null);
      try {
        const result = await getImpactOptions(mode);
        setOptions(result);
        setName("");
      } catch (caught) {
        setOptions([]);
        setName("");
        setError(caught instanceof Error ? caught.message : "Unable to load impact options.");
      }
    }

    void loadOptions();
  }, [mode]);

  const childMetric = impact ? affectedChildMetric(impact, mode) : null;
  
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Impact Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Find affected services, channels, and dependency paths.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-[180px_minmax(0,360px)_auto]">
          <CommandSelect
            options={impactModeOptions}
            value={mode}
            onValueChange={(value) => setMode(value as ImpactMode)}
            placeholder="Select type"
            searchPlaceholder="Search types..."
          />
          <CommandSelect
            options={options.map((option) => ({ label: option.name, value: option.name }))}
            value={name}
            onValueChange={setName}
            placeholder={mode === "app" ? "Select application" : "Select integration"}
            searchPlaceholder={mode === "app" ? "Search applications..." : "Search integrations..."}
            emptyText={mode === "app" ? "No applications found." : "No integrations found."}
            showFullText
          />
          <Button onClick={analyze} disabled={loading || !name.trim()}>
            <GitBranch className="h-4 w-4" />
            {loading ? "Analyzing" : "Analyze"}
          </Button>
        </div>
      </div>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p> : null}

      {impact ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <GraphCanvas graph={impactGraphForCanvas(impact)} height={620} title="Impact Flow" />
          <div className="min-w-0 max-h-[620px] w-full space-y-5 overflow-y-auto pr-1 xl:sticky xl:top-20">
            <Panel className="w-full space-y-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-md ${impactLevelTone(impact.impactLevel).icon}`}>
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Impact Summary</h2>
                  <p className="text-sm text-muted-foreground">{impact.source.name}</p>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Impact Level</div>
                <div className={`mt-2 inline-flex rounded-md border px-3 py-1.5 text-xl font-semibold ${impactLevelTone(impact.impactLevel).badge}`}>
                  {impact.impactLevel}
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Metric label="Services" value={impact.affectedServices.length} />
                <Metric label="Channels" value={impact.affectedDirectChannels.length} /> 
                {childMetric ? <Metric label={childMetric.label} value={childMetric.value} /> : null}
              </div>
            </Panel>
            <Panel className="max-h-[420px] w-full overflow-auto">
              <h2 className="mb-4 font-semibold">Affected Channels</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {impact.affectedDirectChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm"
                  >
                    <div className="font-semibold truncate">{channel.name}</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="max-h-[320px] w-full overflow-auto">
              <h2 className="mb-4 font-semibold">Affected Services</h2>
              <JsonObjectView
                value={{
                  serviceNames: impact.affectedServices.map((service) => service.name),
                  count: impact.affectedServices.length
                }}
              />
            </Panel>
          </div>
        </div>
      ) : (
        <GraphCanvas height={620} title="Impact Flow" />
      )}
    </div>
  );
}

function impactGraphForCanvas(impact: ImpactResponse) {
  const visibleTypes = new Set(["Application", "Integration"]);
  const visibleNodeIds = new Set(impact.graph.nodes.filter((node) => visibleTypes.has(node.type)).map((node) => node.id));
  return {
    ...impact.graph,
    nodes: impact.graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: impact.graph.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    rootNodeId: visibleNodeIds.has(impact.graph.rootNodeId ?? "") ? impact.graph.rootNodeId : impact.graph.nodes.find((node) => visibleTypes.has(node.type))?.id
  };
}

function affectedChildMetric(impact: ImpactResponse, mode: ImpactMode) {
  const sourceId = impact.graph.rootNodeId;
  if (!sourceId) {
    return {
      label: mode === "app" ? "Integrations" : "Apps",
      value: 0
    };
  }

  const childType = mode === "app" ? "Integration" : "Application";
  const childIds = new Set(
    impact.graph.edges
      .filter((edge) => edge.source === sourceId)
      .map((edge) => edge.target)
      .filter((nodeId) => impact.graph.nodes.find((node) => node.id === nodeId)?.type === childType)
  );

  return {
    label: mode === "app" ? "Integrations" : "Apps",
    value: childIds.size
  };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function impactLevelTone(level: string) {
  if (level === "Low") {
    return {
      icon: "bg-emerald-500/15 text-emerald-300",
      badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    };
  }
  if (level === "Medium") {
    return {
      icon: "bg-amber-500/15 text-amber-300",
      badge: "border-amber-400/50 bg-amber-400/10 text-amber-400"
    };
  }
  if (level === "High") {
    return {
      icon: "bg-orange-500/15 text-orange-300",
      badge: "border-orange-400/30 bg-orange-400/10 text-orange-200"
    };
  }
  return {
    icon: "bg-red-500/15 text-red-300",
    badge: "border-red-400/30 bg-red-400/10 text-red-200"
  };
}

function JsonObjectView({ value }: { value: { serviceNames: string[]; count: number } }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative w-full overflow-auto rounded-md border border-white/10 bg-[#050b16] p-3 font-mono text-xs leading-6 shadow-inner">
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        title="Copy JSON"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>

      <div>
        <span className="text-slate-500">{"{"}</span>
      </div>
      <div className="pl-4">
        <span className="text-sky-300">"serviceNames"</span>
        <span className="text-slate-400">: </span>
        <span className="text-slate-500">[</span>
      </div>

      {value.serviceNames.map((serviceName, index) => (
        <div key={serviceName} className="pl-8">
          <span className="text-emerald-300">"{serviceName}"</span>
          {index < value.serviceNames.length - 1 && (
            <span className="text-slate-400">,</span>
          )}
        </div>
      ))}

      <div className="pl-4">
        <span className="text-slate-500">]</span>
        <span className="text-slate-400">,</span>
      </div>

      <div className="pl-4">
        <span className="text-sky-300">"count"</span>
        <span className="text-slate-400">: </span>
        <span className="text-orange-300">{value.count}</span>
      </div>

      <div>
        <span className="text-slate-500">{"}"}</span>
      </div>
    </div>
  );
}
