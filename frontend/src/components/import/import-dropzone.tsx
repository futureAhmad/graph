"use client";

import { useState } from "react";
import type { ImportSummary } from "@/shared";
import { Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { deleteImportedData, importWorkbook } from "@/features/import/import.api";

export function ImportDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function submit() {
    if (!file) {
      setError("Select an Excel file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      setSummary(await importWorkbook(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteData() {
    setDeleting(true);
    setError(null);
    setSummary(null);

    try {
      await deleteImportedData();
      setFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    } finally {
      setDeleting(false);
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
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <Input type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <Button onClick={submit} disabled={loading || deleting}>
          {loading ? "Importing" : "Import"}
        </Button>
        <Button variant="destructive" onClick={deleteData} disabled={loading || deleting}>
          <Trash2 className="h-4 w-4" />
          {deleting ? "Deleting" : "Delete Data"}
        </Button>
      </div>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p> : null}
      {summary ? (
        <div className="grid gap-3 text-sm md:grid-cols-1">
          <Metric label="Dependency Rows" value={summary.rowsImported} />
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
