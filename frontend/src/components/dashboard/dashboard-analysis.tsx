"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, Building2, Network, RefreshCw, UsersRound } from "lucide-react";
import type { ExecutiveDashboardResponse, ExecutiveMetric } from "@/shared";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getExecutiveDashboard } from "@/features/graph/graph.api";

export function DashboardAnalysis() {
  const [dashboard, setDashboard] = useState<ExecutiveDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = () => {
    setLoading(true);
    setError(null);
    getExecutiveDashboard()
      .then(setDashboard)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load dashboard."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ChartErrorState message={error} onRetry={loadDashboard} />;
  }

  if (!dashboard || dashboard.summary.totalServices.value === 0) {
    return (
      <Panel className="text-sm text-muted-foreground">
        No dashboard data available. Import service dependency data to populate charts.
      </Panel>
    );
  }

  const servicesByFunction = [...dashboard.servicesByFunction].sort(
    (left, right) => right.services - left.services || left.name.localeCompare(right.name)
  );
  const thirdPartyServices = [...dashboard.topThirdParties].sort(
    (left, right) => right.services - left.services || left.name.localeCompare(right.name)
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatisticCard
          icon={Boxes}
          title="Total services"
          metric={dashboard.summary.totalServices}
          tone="blue"
        />
        <StatisticCard
          icon={Building2}
          title="Business functions"
          metric={dashboard.summary.totalFunctions}
          tone="sky"
        />
        <StatisticCard
          icon={UsersRound}
          title="Third parties"
          metric={dashboard.summary.totalThirdParties}
          tone="violet"
        />
        <StatisticCard
          icon={Network}
          title="Integrations"
          metric={dashboard.summary.totalIntegrations}
          tone="orange"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="overflow-visible p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Number of services per function</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Distinct services grouped by business function.
            </p>
          </div>
          <div className="overflow-x-auto px-2 pb-3 pt-4">
            <div className="min-w-[560px]">
              <HorizontalBarChart
                rows={servicesByFunction.map((row) => ({ name: row.name, value: row.services }))}
                colorClass="bg-blue-600"
                label="services"
              />
            </div>
          </div>
        </Panel>

        <Panel className="overflow-visible p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Services run by third party</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Distinct services supported by each third-party company.
            </p>
          </div>
          <div className="overflow-x-auto px-2 pb-3 pt-4">
            <div className="min-w-[620px]">
              <HorizontalBarChart
                rows={thirdPartyServices.map((row) => ({ name: row.name, value: row.services }))}
                colorClass="bg-sky-500"
                label="services"
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function HorizontalBarChart({
  rows,
  colorClass,
  label
}: {
  rows: Array<{ name: string; value: number }>;
  colorClass: string;
  label: string;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  if (rows.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No data available.</div>;
  }

  return (
    <div className="space-y-3 px-3 pb-2 pt-1">
      <div className="grid grid-cols-[minmax(10rem,15rem)_1fr_3rem] items-center gap-3 border-b border-border pb-2 text-xs font-medium uppercase text-muted-foreground">
        <span>Name</span>
        <span>Number of services</span>
        <span className="text-right">Count</span>
      </div>
      {rows.map((row) => {
        const width = `${Math.max(4, (row.value / maxValue) * 100)}%`;
        return (
          <div key={row.name} className="group relative grid grid-cols-[minmax(10rem,15rem)_1fr_3rem] items-center gap-3">
            <div className="truncate text-sm font-medium" title={row.name}>
              {row.name}
            </div>
            <div className="relative h-8 rounded-md bg-muted/60">
              <div className={`h-full rounded-md ${colorClass}`} style={{ width }} />
              <div
                className="pointer-events-none absolute left-3 top-1/2 z-50 min-w-[12rem] -translate-y-[45%] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 opacity-0 shadow-2xl ring-1 ring-black/5 transition-all duration-150 ease-out group-hover:-translate-y-1/2 group-hover:opacity-100 group-focus-within:-translate-y-1/2 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:ring-white/10"
                role="tooltip"
              >
                <div className="font-medium">{row.name}</div>
                <div className="mt-1 flex items-center justify-between gap-6 text-slate-500 dark:text-slate-300">
                  <span>{label}</span>
                  <span className="font-mono font-medium text-slate-950 dark:text-white">{formatNumber(row.value)}</span>
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-sm font-semibold">{formatNumber(row.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatisticCard({
  icon: Icon,
  title,
  metric,
  tone
}: {
  icon: typeof Boxes;
  title: string;
  metric: ExecutiveMetric;
  tone: "blue" | "sky" | "violet" | "orange";
}) {
  const toneClass = {
    blue: "bg-blue-500/15 text-blue-300",
    sky: "bg-sky-500/15 text-sky-300",
    violet: "bg-violet-500/15 text-violet-300",
    orange: "bg-orange-500/15 text-orange-300"
  }[tone];

  return (
    <Panel className="space-y-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="mt-1 text-3xl font-semibold">{formatNumber(metric.value)}</div>
        <p className="mt-1 text-sm text-muted-foreground">{metric.interpretation}</p>
      </div>
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-80 animate-pulse rounded-md border border-border bg-muted/40" />
      <div className="h-96 animate-pulse rounded-md border border-border bg-muted/40" />
    </div>
  );
}

function ChartErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="h-4 w-4" />
        Unable to load dashboard
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" className="w-fit" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </Panel>
  );
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}
