import { BadRequestException, Injectable } from "@nestjs/common";
import { CANONICAL_NODE_TYPES, ImportSummary, RELATIONSHIP_TYPES } from "../../shared";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import {
  hasValue,
  normalizeHeader,
  normalizeName,
  toEntityKey,
  toRelationshipKey
} from "../../common/utils/text-normalizer";
import { GraphRepository } from "../graph/graph.repository";
import { ColumnRegistryService } from "./column-registry.service";
import { ImportRequestDto } from "./dto/import-request.dto";
import {
  ImportFactInput,
  ImportHardwareSpecInput,
  ImportNodeInput,
  ImportPlan,
  ImportRelationshipInput,
  ImportThirdPartyInput
} from "./import.types";

type WorkbookRow = Record<string, unknown>;

@Injectable()
export class ImportService {
  constructor(
    private readonly columnRegistry: ColumnRegistryService,
    private readonly graphRepository: GraphRepository
  ) {}

  async importWorkbook(file: Express.Multer.File, request: ImportRequestDto): Promise<ImportSummary> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("An Excel file is required.");
    }

    const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
    if (workbook.SheetNames.length === 0) {
      throw new BadRequestException("Workbook does not contain any sheets.");
    }

    const plan = this.createWorkbookImportPlan(workbook, {
      datasetId: request.datasetId,
      sourceName: request.sourceName || file.originalname
    });

    await this.graphRepository.mergeImportPlan(plan);

    return {
      importId: plan.importId,
      datasetId: plan.datasetId,
      sourceName: plan.sourceName,
      sheetName: plan.sheetName,
      rowsRead: plan.rowsRead,
      rowsImported: plan.rowsImported,
      nodesPlanned: plan.nodes.length,
      relationshipsPlanned: plan.relationships.length,
      warnings: plan.warnings
    };
  }

  async deleteImportedData(): Promise<{ deleted: true }> {
    return this.graphRepository.deleteImportedData();
  }

  createImportPlan(
    rows: WorkbookRow[],
    options: { datasetId: string; sourceName: string; sheetName: string }
  ): ImportPlan {
    const importId = randomUUID();
    const warnings: string[] = [];
    const normalizedHeaders = this.getHeaders(rows);
    const functionHeader = normalizedHeaders.find(
      (header) => this.columnRegistry.resolve(header).nodeType === CANONICAL_NODE_TYPES.FUNCTION
    );
    const serviceHeader = normalizedHeaders.find((header) => this.columnRegistry.resolve(header).isServiceColumn);
    const serviceCriticalHeader = normalizedHeaders.find((header) =>
      ["critical service", "critical_service"].includes(normalizeHeader(header))
    );

    if (!serviceHeader) {
      throw new BadRequestException("Required column missing: service name.");
    }

    const dependencyColumns = normalizedHeaders
      .map((header) => this.columnRegistry.resolve(header))
      .filter(
        (column) =>
          !column.isServiceColumn &&
          column.nodeType !== CANONICAL_NODE_TYPES.FUNCTION &&
          !isMetadataColumn(column.normalizedHeader)
      )
      .sort((left, right) => dependencyOrder(left.nodeType) - dependencyOrder(right.nodeType));
    const nodes = new Map<string, ImportNodeInput>();
    const relationships = new Map<string, ImportRelationshipInput>();
    const facts = new Map<string, ImportFactInput>();
    let rowsImported = 0;

    rows.forEach((row) => {
      const serviceValue = this.valueForHeader(row, serviceHeader);
      if (!hasValue(serviceValue)) {
        warnings.push(`Row skipped because service name is blank.`);
        return;
      }

      const serviceNode = this.toNode(options.datasetId, CANONICAL_NODE_TYPES.SERVICE, serviceValue, serviceHeader);
      nodes.set(serviceNode.entityKey, serviceNode);

      let parentNode = serviceNode;
      const pathNodes: ImportNodeInput[] = [];
      for (const column of dependencyColumns) {
        const value = this.valueForHeader(row, column.originalHeader);
        if (!hasValue(value)) {
          return;
        }

        const childNode = this.toNode(options.datasetId, column.nodeType, value, column.originalHeader);
        const relationshipType =
          parentNode.type === CANONICAL_NODE_TYPES.SERVICE && childNode.type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL
            ? RELATIONSHIP_TYPES.AVAILABLE_ON
            : RELATIONSHIP_TYPES.DEPENDS_ON;

        nodes.set(childNode.entityKey, childNode);
        this.addRelationship(relationships, options.datasetId, parentNode, childNode, relationshipType, column.originalHeader);
        parentNode = childNode;
        pathNodes.push(childNode);
      }

      const directChannelNode = pathNodes.find((node) => node.type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL);
      const applicationNode = pathNodes.find((node) => node.type === CANONICAL_NODE_TYPES.APPLICATION);
      const integrationNode = pathNodes.find((node) => node.type === CANONICAL_NODE_TYPES.INTEGRATION);

      if (!directChannelNode || !applicationNode || !integrationNode) {
        warnings.push(`Row skipped because dc, app, or integ is blank.`);
        return;
      }

      rowsImported += 1;
      const factKey = [
        options.datasetId,
        serviceNode.normalizedName,
        directChannelNode.normalizedName,
        applicationNode.normalizedName,
        integrationNode.normalizedName
      ].join(":");
      facts.set(factKey, {
        functionName: functionHeader ? String(this.valueForHeader(row, functionHeader) ?? "").trim() || undefined : undefined,
        serviceName: serviceNode.name,
        serviceIsCritical: serviceCriticalHeader ? isCriticalValue(String(this.valueForHeader(row, serviceCriticalHeader) ?? "")) : false,
        directChannelName: directChannelNode.name,
        applicationName: applicationNode.name,
        integrationName: integrationNode.name
      });
    });

    return {
      importId,
      datasetId: options.datasetId,
      sourceName: options.sourceName,
      sheetName: options.sheetName,
      rowsRead: rows.length,
      rowsImported,
      warnings,
      nodes: Array.from(nodes.values()),
      relationships: Array.from(relationships.values()),
      facts: Array.from(facts.values()),
      hardwareSpecs: [],
      thirdParties: []
    };
  }

  createWorkbookImportPlan(workbook: XLSX.WorkBook, options: { datasetId: string; sourceName: string }): ImportPlan {
    const dependencySheetName = workbook.SheetNames[0];
    const hardwareSheetName = workbook.SheetNames[1];
    const thirdPartySheetName = workbook.SheetNames[2];
    if (!dependencySheetName) {
      throw new BadRequestException("Workbook must contain Sheet1 dependency data.");
    }

    const dependencyRows = this.sheetRows(workbook, dependencySheetName);
    const plan = this.createImportPlan(dependencyRows, {
      datasetId: options.datasetId,
      sourceName: options.sourceName,
      sheetName: workbook.SheetNames.join(", ")
    });
    const nodes = new Map(plan.nodes.map((node) => [node.entityKey, node]));
    const relationships = new Map(plan.relationships.map((relationship) => [relationship.relationshipKey, relationship]));

    if (hardwareSheetName) {
      plan.hardwareSpecs = this.createHardwareSpecFacts(this.sheetRows(workbook, hardwareSheetName), {
        datasetId: options.datasetId,
        nodes,
        relationships
      });
    }

    if (thirdPartySheetName) {
      plan.thirdParties = this.createThirdPartyFacts(this.sheetRows(workbook, thirdPartySheetName), {
        datasetId: options.datasetId,
        nodes,
        relationships
      });
    }

    plan.nodes = Array.from(nodes.values());
    plan.relationships = Array.from(relationships.values());
    plan.rowsRead = dependencyRows.length + plan.hardwareSpecs.length + plan.thirdParties.length;
    plan.rowsImported = plan.facts.length;
    return plan;
  }

  private sheetRows(workbook: XLSX.WorkBook, sheetName: string): WorkbookRow[] {
    return XLSX.utils.sheet_to_json<WorkbookRow>(workbook.Sheets[sheetName], {
      defval: "",
      raw: false
    });
  }

  private createHardwareSpecFacts(
    rows: WorkbookRow[],
    options: {
      datasetId: string;
      nodes: Map<string, ImportNodeInput>;
      relationships: Map<string, ImportRelationshipInput>;
    }
  ): ImportHardwareSpecInput[] {
    const facts = new Map<string, ImportHardwareSpecInput>();
    const sourceHeader = this.findHeader(rows, ["source"]);
    const hardwareColumns = [
      { category: "server", valueHeaders: ["server"], criticalHeaders: ["server_is_critical", "server critical"] },
      { category: "os", valueHeaders: ["os"], criticalHeaders: ["os_is_critical", "os critical"] },
      {
        category: "virtualization",
        valueHeaders: ["virtualization", "virtualisation"],
        criticalHeaders: ["virtualization_is_critical", "virtualisation_is_critical", "virtualization critical"]
      },
      {
        category: "load_balancer",
        valueHeaders: ["load_balancer", "load balancer"],
        criticalHeaders: ["load_balancer_is_critical", "load balancer critical"]
      },
      { category: "firewall", valueHeaders: ["firewall"], criticalHeaders: ["firewall_is_critical", "firewall critical"] },
      { category: "backup", valueHeaders: ["backup"], criticalHeaders: ["backup_is_critical", "backup critical"] },
      { category: "storage", valueHeaders: ["storage"], criticalHeaders: ["storage_is_critical", "storage critical"] },
      { category: "db", valueHeaders: ["db", "database"], criticalHeaders: ["db_is_critical", "database_is_critical", "db critical"] },
      { category: "dns", valueHeaders: ["dns_required", "dns required"], criticalHeaders: ["dns_required", "dns required"] }
    ]
      .map((column) => ({
        ...column,
        valueHeader: this.findHeader(rows, column.valueHeaders),
        criticalHeader: this.findHeader(rows, column.criticalHeaders)
      }))
      .filter((column) => column.valueHeader);

    if (!sourceHeader || hardwareColumns.length === 0) {
      return [];
    }

    rows.forEach((row) => {
      const sourceName = this.valueForHeader(row, sourceHeader);
      if (!hasValue(sourceName)) {
        return;
      }

      const sourceNode = this.resolveHardwareSourceNode(options.datasetId, options.nodes, sourceName, sourceHeader);
      if (!sourceNode) {
        return;
      }

      options.nodes.set(sourceNode.entityKey, sourceNode);

      hardwareColumns.forEach((column) => {
        if (!column.valueHeader) {
          return;
        }
        const specName = this.valueForHeader(row, column.valueHeader);
        if (!hasValue(specName) || isNegativeHardwareValue(specName)) {
          return;
        }

        const specNode = this.toNode(options.datasetId, CANONICAL_NODE_TYPES.HARDWARE_SPEC, specName, column.valueHeader);
        const criticalityLabel = column.criticalHeader ? String(this.valueForHeader(row, column.criticalHeader) ?? "").trim() : "";

        options.nodes.set(specNode.entityKey, specNode);
        this.addRelationship(
          options.relationships,
          options.datasetId,
          sourceNode,
          specNode,
          RELATIONSHIP_TYPES.HAS_HARDWARE,
          column.valueHeader
        );

        facts.set([options.datasetId, sourceNode.type, sourceNode.normalizedName, specNode.normalizedName].join(":"), {
          sourceName: sourceNode.name,
          sourceType:
            sourceNode.type === CANONICAL_NODE_TYPES.APPLICATION
              ? CANONICAL_NODE_TYPES.APPLICATION
              : CANONICAL_NODE_TYPES.INTEGRATION,
          specName: specNode.name,
          specCategory: column.category,
          isCritical: isCriticalValue(criticalityLabel)
        });
      });
    });

    return Array.from(facts.values());
  }

  private createThirdPartyFacts(
    rows: WorkbookRow[],
    options: {
      datasetId: string;
      nodes: Map<string, ImportNodeInput>;
      relationships: Map<string, ImportRelationshipInput>;
    }
  ): ImportThirdPartyInput[] {
    const functionHeader = this.findHeader(rows, ["function name", "function"]);
    const serviceHeader = this.findHeader(rows, ["service name", "service"]);
    const directChannelHeader = this.findHeader(rows, ["dc", "direct channel"]);
    const applicationHeader = this.findHeader(rows, ["app", "application"]);
    const thirdPartyHeader =
      this.findHeader(rows, ["company name"]) ??
      this.findHeader(rows, ["thrid", "third", "third party", "thrid party", "vendor", "provider"]);
    const thirdPartyCompositeHeader = this.findHeader(rows, ["thrid", "third", "third party", "thrid party"]);

    if (!serviceHeader || !directChannelHeader || !applicationHeader || !thirdPartyHeader) {
      return [];
    }

    const facts = new Map<string, ImportThirdPartyInput>();

    rows.forEach((row) => {
      const serviceValue = this.valueForHeader(row, serviceHeader);
      const directChannelValue = this.valueForHeader(row, directChannelHeader);
      const applicationValue = this.valueForHeader(row, applicationHeader);
      const thirdPartyValue = this.resolveThirdPartyCompanyName(row, thirdPartyHeader, thirdPartyCompositeHeader);
      if (!hasValue(serviceValue) || !hasValue(directChannelValue) || !hasValue(applicationValue) || !hasValue(thirdPartyValue)) {
        return;
      }

      const serviceNode = this.toNode(options.datasetId, CANONICAL_NODE_TYPES.SERVICE, serviceValue, serviceHeader);
      const directChannelNode = this.toNode(
        options.datasetId,
        CANONICAL_NODE_TYPES.DIRECT_CHANNEL,
        directChannelValue,
        directChannelHeader
      );
      const applicationNode = this.toNode(
        options.datasetId,
        CANONICAL_NODE_TYPES.APPLICATION,
        applicationValue,
        applicationHeader
      );
      const thirdPartyNode = this.toNode(options.datasetId, CANONICAL_NODE_TYPES.THIRD_PARTY, thirdPartyValue, thirdPartyHeader);

      options.nodes.set(serviceNode.entityKey, serviceNode);
      options.nodes.set(directChannelNode.entityKey, directChannelNode);
      options.nodes.set(applicationNode.entityKey, applicationNode);
      options.nodes.set(thirdPartyNode.entityKey, thirdPartyNode);
      this.addRelationship(options.relationships, options.datasetId, applicationNode, thirdPartyNode, RELATIONSHIP_TYPES.RUN_BY, thirdPartyHeader);

      facts.set(
        [
          options.datasetId,
          serviceNode.normalizedName,
          directChannelNode.normalizedName,
          applicationNode.normalizedName,
          thirdPartyNode.normalizedName
        ].join(":"),
        {
          functionName: functionHeader ? String(this.valueForHeader(row, functionHeader) ?? "").trim() || undefined : undefined,
          serviceName: serviceNode.name,
          directChannelName: directChannelNode.name,
          applicationName: applicationNode.name,
          thirdPartyName: thirdPartyNode.name
        }
      );
    });

    return Array.from(facts.values());
  }

  private resolveHardwareSourceNode(
    datasetId: string,
    nodes: Map<string, ImportNodeInput>,
    sourceName: unknown,
    sourceHeader: string
  ): ImportNodeInput | undefined {
    const normalizedSourceName = normalizeName(String(sourceName));
    const existingNode = Array.from(nodes.values()).find(
      (node) =>
        node.normalizedName === normalizedSourceName &&
        (node.type === CANONICAL_NODE_TYPES.APPLICATION || node.type === CANONICAL_NODE_TYPES.INTEGRATION)
    );
    if (existingNode) {
      return existingNode;
    }

    return this.toNode(datasetId, CANONICAL_NODE_TYPES.INTEGRATION, sourceName, sourceHeader);
  }

  private resolveThirdPartyCompanyName(
    row: WorkbookRow,
    companyHeader: string | undefined,
    compositeHeader: string | undefined
  ): string | undefined {
    const companyName = companyHeader ? String(this.valueForHeader(row, companyHeader) ?? "").trim() : "";
    if (companyName) {
      return companyName;
    }

    const compositeValue = compositeHeader ? String(this.valueForHeader(row, compositeHeader) ?? "").trim() : "";
    const match = compositeValue.match(/\(([^()]*)\)\s*$/);
    return (match?.[1] ?? compositeValue).trim() || undefined;
  }

  private getHeaders(rows: WorkbookRow[]): string[] {
    const firstRow = rows[0];
    if (!firstRow) {
      throw new BadRequestException("Workbook sheet is empty.");
    }

    return Object.keys(firstRow).filter((header) => normalizeHeader(header).length > 0);
  }

  private findHeader(rows: WorkbookRow[], candidates: string[]): string | undefined {
    if (rows.length === 0) {
      return undefined;
    }
    const headers = this.getHeaders(rows);
    const normalizedCandidates = candidates.map((candidate) => normalizeHeader(candidate));
    return headers.find((header) => normalizedCandidates.includes(normalizeHeader(header)));
  }

  private valueForHeader(row: WorkbookRow, header: string): unknown {
    const exactValue = row[header];
    if (exactValue !== undefined) {
      return exactValue;
    }

    const normalizedTarget = normalizeHeader(header);
    const matchingKey = Object.keys(row).find((key) => normalizeHeader(key) === normalizedTarget);
    return matchingKey ? row[matchingKey] : undefined;
  }

  private toNode(datasetId: string, type: string, value: unknown, sourceColumn: string): ImportNodeInput {
    const name = String(value).trim();
    const normalizedName = normalizeName(name);

    return {
      entityKey: toEntityKey(datasetId, type, normalizedName),
      datasetId,
      label: type,
      type,
      name,
      normalizedName,
      sourceColumns: [sourceColumn]
    };
  }

  private addRelationship(
    relationships: Map<string, ImportRelationshipInput>,
    datasetId: string,
    fromNode: ImportNodeInput,
    toNode: ImportNodeInput,
    type: string,
    sourceColumn: string
  ) {
    const relationshipKey = toRelationshipKey(datasetId, fromNode.entityKey, type, toNode.entityKey);
    relationships.set(relationshipKey, {
      relationshipKey,
      datasetId,
      fromKey: fromNode.entityKey,
      toKey: toNode.entityKey,
      type,
      sourceColumn
    });
  }
}

function classifyHardwareSpec(specName: string): string {
  const normalized = normalizeName(specName);
  if (/\b(db|database|oracle|sql|postgres|mysql)\b/.test(normalized)) return "database";
  if (/\b(firewall|palo alto|fortigate)\b/.test(normalized)) return "firewall";
  if (/\b(load balancer|f5|balancer)\b/.test(normalized)) return "load_balancer";
  if (/\b(server|servers|dell|hpe|hp)\b/.test(normalized)) return "server";
  if (/\b(os|linux|windows|redhat|rhel)\b/.test(normalized)) return "os";
  if (/\b(vmware|virtualization|virtualisation|hypervisor)\b/.test(normalized)) return "virtualization";
  if (/\b(backup|netbackup)\b/.test(normalized)) return "backup";
  if (/\b(dns)\b/.test(normalized)) return "dns";
  if (/\b(storage|san|nas)\b/.test(normalized)) return "storage";
  if (/\b(router|switch|network)\b/.test(normalized)) return "network";
  if (/\b(mq|ibm|middleware)\b/.test(normalized)) return "middleware";
  return "other";
}

function isCriticalValue(value: string): boolean {
  return ["critical", "yes", "y", "true", "1"].includes(normalizeName(value));
}

function isNegativeHardwareValue(value: unknown): boolean {
  return ["no", "n", "false", "0", "none", "na", "n/a", "not required"].includes(normalizeName(String(value)));
}

function isMetadataColumn(normalizedHeader: string): boolean {
  return normalizedHeader === "no" || normalizedHeader.startsWith("critical ") || normalizedHeader.startsWith("critical_");
}

function dependencyOrder(type: string): number {
  if (type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL) {
    return 10;
  }
  if (type === CANONICAL_NODE_TYPES.APPLICATION) {
    return 20;
  }
  if (type === CANONICAL_NODE_TYPES.INTEGRATION) {
    return 30;
  }
  return 100;
}
