import { ImportDropzone } from "@/components/import/import-dropzone";

export default function ImportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Import Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Load the three-sheet Excel workbook into PostgreSQL for service dependency and impact analysis.
        </p>
      </div>
      <ImportDropzone />
    </div>
  );
}
