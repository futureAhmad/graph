import { Activity, Database, Network, ShieldCheck } from "lucide-react";
import { StatCards } from "@/components/import/stat-cards";
import { Panel } from "@/components/ui/panel";

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Dependency Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live graph statistics read directly from PostgreSQL.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Database connected
        </div>
      </div>
      <StatCards />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/15 text-blue-300">
              <Network className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Operational Graph</h2>
              <p className="text-sm text-muted-foreground">Explore the current imported dependency map.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Insight icon={Database} label="Source" value="PostgreSQL" />
            <Insight icon={Activity} label="Mode" value="Live" />
            <Insight icon={ShieldCheck} label="Status" value="Ready" />
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold">Next Actions</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>Open Services to inspect dependencies in the organized flow map.</p>
            <p>Open Impact Analysis to evaluate affected services and channels.</p>
            <p>Use Global Search to center the graph on any entity in the database.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Insight({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
      <Icon className="mb-3 h-5 w-5 text-sky-300" />
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
