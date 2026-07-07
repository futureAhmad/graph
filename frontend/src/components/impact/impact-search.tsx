"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImpactResponse, SearchResultItem } from "@service-dependency/shared";
import { AlertTriangle, GitBranch } from "lucide-react";
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { apiClient } from "@/lib/api";

type ImpactMode = "app" | "integ";

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
      const result = await apiClient<ImpactResponse>(`/impact/${mode}/${encodeURIComponent(name)}`);
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
        const result = await apiClient<SearchResultItem[]>(`/impact/${mode}`);
        setOptions(result);
        setName(result[0]?.name || "");
      } catch (caught) {
        setOptions([]);
        setName("");
        setError(caught instanceof Error ? caught.message : "Unable to load impact options.");
      }
    }

    void loadOptions();
  }, [mode]);

  useEffect(() => {
    if (name) {
      void analyze();
    }
  }, [analyze, name]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Impact Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Find affected services, channels, and dependency paths.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-[160px_minmax(0,280px)_auto]">
          <select
            className="h-10 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm"
            value={mode}
            onChange={(event) => setMode(event.target.value as ImpactMode)}
          >
            <option value="app">Application</option>
            <option value="integ">Integration</option>
          </select>
          <select
            className="h-10 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.entityKey} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
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
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Services" value={impact.affectedServices.length} />
                <Metric label="Channels" value={impact.affectedDirectChannels.length} />
              </div>
            </Panel>
            <Panel className="max-h-[420px] w-full overflow-auto">
              <h2 className="mb-4 font-semibold">Affected Channels</h2>
              <div className="space-y-2">
                {impact.affectedDirectChannels.map((channel) => (
                  <div key={channel.id} className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm">
                    <div className="font-semibold">{channel.name}</div>
                    <div className="mt-1 break-all text-xs text-muted-foreground">{channel.entityKey}</div>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
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
      badge: "border-amber-400/30 bg-amber-400/10 text-amber-200"
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
  return (
    <div className="w-full overflow-auto rounded-md border border-white/10 bg-[#050b16] p-3 font-mono text-xs leading-6 shadow-inner">
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
          {index < value.serviceNames.length - 1 ? <span className="text-slate-400">,</span> : null}
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
