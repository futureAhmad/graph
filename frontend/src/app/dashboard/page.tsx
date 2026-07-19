import { DashboardAnalysis } from "@/components/dashboard/dashboard-analysis";

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Service Dependency Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregated service counts by business function and third-party company.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Database connected
        </div>
      </div>
      <DashboardAnalysis />
    </div>
  );
}
