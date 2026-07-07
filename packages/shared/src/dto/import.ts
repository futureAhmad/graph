export interface ImportSummary {
  importId: string;
  datasetId: string;
  sourceName: string;
  sheetName: string;
  rowsRead: number;
  rowsImported: number;
  nodesPlanned: number;
  relationshipsPlanned: number;
  warnings: string[];
}

export interface SearchResultItem {
  entityKey: string;
  name: string;
  normalizedName: string;
  type: string;
  datasetId: string;
}
