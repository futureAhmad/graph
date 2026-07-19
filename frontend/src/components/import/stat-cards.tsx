"use client";

import { useEffect, useState } from "react";
import type { GraphStatistics } from "@/shared";
import { Boxes, DatabaseZap, Network } from "lucide-react";
import { getGraphStatistics } from "@/features/graph/graph.api";

export function StatCards() {
  const [stats, setStats] = useState<GraphStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGraphStatistics()
      .then(setStats)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load statistics."));
  }, []);

  if (error) {
    return <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">{error}</div>;
  }

  const services = stats?.nodesByType.Service ?? 0;
  const applications = stats?.nodesByType.Application ?? 0;
  const integrations = stats?.nodesByType.Integration ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={Network} label="Services" value={services} tone="text-sky-300" />
      <Metric icon={Boxes} label="Applications" value={applications} tone="text-orange-300" />
      <Metric icon={DatabaseZap} label="Integrations" value={integrations} tone="text-blue-300" />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Network;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-card/80 p-4">
      <Icon className={`mb-4 h-5 w-5 ${tone}`} />
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}
