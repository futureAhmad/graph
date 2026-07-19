import type { ImportSummary } from "@/shared";

export async function importWorkbook(file: File): Promise<ImportSummary> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/import", {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<ImportSummary>;
}

export async function deleteImportedData(): Promise<void> {
  const response = await fetch("/api/import", { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
