export interface ImportNodeInput {
  entityKey: string;
  datasetId: string;
  label: string;
  type: string;
  name: string;
  normalizedName: string;
  sourceColumns: string[];
}

export interface ImportRelationshipInput {
  relationshipKey: string;
  datasetId: string;
  fromKey: string;
  toKey: string;
  type: string;
  sourceColumn: string;
}

export interface ImportFactInput {
  datasetId: string;
  sourceRowNumber: number;
  functionName?: string;
  serviceName: string;
  directChannelName: string;
  applicationName: string;
  integrationName: string;
}

export interface ImportHardwareSpecInput {
  datasetId: string;
  sourceRowNumber: number;
  integrationName: string;
  specName: string;
  specCategory: string;
  isCritical: boolean;
  criticalityLabel?: string;
}

export interface ImportThirdPartyInput {
  datasetId: string;
  sourceRowNumber: number;
  functionName?: string;
  serviceName: string;
  directChannelName: string;
  applicationName: string;
  thirdPartyName: string;
}

export interface ImportPlan {
  importId: string;
  datasetId: string;
  sourceName: string;
  sheetName: string;
  rowsRead: number;
  rowsImported: number;
  warnings: string[];
  nodes: ImportNodeInput[];
  relationships: ImportRelationshipInput[];
  facts: ImportFactInput[];
  hardwareSpecs: ImportHardwareSpecInput[];
  thirdParties: ImportThirdPartyInput[];
}
