"use client";

import { useState } from "react";
import type { ImportSummary } from "@service-dependency/shared";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

export function ImportDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState("default");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!file) {
      setError("Select an Excel file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);

    const form = new FormData();
    form.append("file", file);
    form.append("datasetId", datasetId);

    try {
      const response = await fetch(`${API_BASE_URL}/import`, {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setSummary((await response.json()) as ImportSummary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <UploadCloud className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Excel Import</h2>
          <p className="text-sm text-muted-foreground">
            Upload the three-sheet dependency workbook into PostgreSQL.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <Input type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <Input value={datasetId} onChange={(event) => setDatasetId(event.target.value)} />
        <Button onClick={submit} disabled={loading}>
          {loading ? "Importing" : "Import"}
        </Button>
      </div>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p> : null}
      {summary ? (
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <Metric label="Dependency Rows" value={summary.rowsImported} />
          <Metric label="Nodes" value={summary.nodesPlanned} />
          <Metric label="Relationships" value={summary.relationshipsPlanned} />
          <Metric label="Dataset" value={summary.datasetId} />
        </div>
      ) : null}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
