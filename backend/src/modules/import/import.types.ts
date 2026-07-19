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
  functionName?: string;
  serviceName: string;
  serviceIsCritical: boolean;
  directChannelName: string;
  applicationName: string;
  integrationName: string;
}

export interface ImportHardwareSpecInput {
  sourceName: string;
  sourceType: "Application" | "Integration";
  specName: string;
  specCategory: string;
  isCritical: boolean;
}

export interface ImportThirdPartyInput {
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
