import { BadRequestException, Injectable } from "@nestjs/common";
import { CANONICAL_NODE_TYPES, ImportSummary, RELATIONSHIP_TYPES } from "@service-dependency/shared";
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

    if (!serviceHeader) {
      throw new BadRequestException("Required column missing: service name.");
    }

    const dependencyColumns = normalizedHeaders
      .map((header) => this.columnRegistry.resolve(header))
      .filter((column) => !column.isServiceColumn && column.nodeType !== CANONICAL_NODE_TYPES.FUNCTION)
      .sort((left, right) => dependencyOrder(left.nodeType) - dependencyOrder(right.nodeType));
    const nodes = new Map<string, ImportNodeInput>();
    const relationships = new Map<string, ImportRelationshipInput>();
    const facts = new Map<string, ImportFactInput>();
    let rowsImported = 0;

    rows.forEach((row, rowIndex) => {
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
        datasetId: options.datasetId,
        sourceRowNumber: rowIndex + 2,
        functionName: functionHeader ? String(this.valueForHeader(row, functionHeader) ?? "").trim() || undefined : undefined,
        serviceName: serviceNode.name,
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
    const integrationHeader = this.findHeader(rows, ["integ", "integration", "integration tool"]);
    const specHeader = this.findHeader(rows, ["spec", "hardware spec", "specification"]);
    const criticalHeader = this.findHeader(rows, ["is_critical", "critical", "criticality"]);

    if (!integrationHeader || !specHeader) {
      return [];
    }

    rows.forEach((row, rowIndex) => {
      const integrationName = this.valueForHeader(row, integrationHeader);
      const specName = this.valueForHeader(row, specHeader);
      if (!hasValue(integrationName) || !hasValue(specName)) {
        return;
      }

      const integrationNode = this.toNode(
        options.datasetId,
        CANONICAL_NODE_TYPES.INTEGRATION,
        integrationName,
        integrationHeader
      );
      const specNode = this.toNode(options.datasetId, CANONICAL_NODE_TYPES.HARDWARE_SPEC, specName, specHeader);
      const criticalityLabel = criticalHeader ? String(this.valueForHeader(row, criticalHeader) ?? "").trim() : "";

      options.nodes.set(integrationNode.entityKey, integrationNode);
      options.nodes.set(specNode.entityKey, specNode);
      this.addRelationship(
        options.relationships,
        options.datasetId,
        integrationNode,
        specNode,
        RELATIONSHIP_TYPES.HAS_HARDWARE,
        specHeader
      );

      facts.set([options.datasetId, integrationNode.normalizedName, specNode.normalizedName].join(":"), {
        datasetId: options.datasetId,
        sourceRowNumber: rowIndex + 2,
        integrationName: integrationNode.name,
        specName: specNode.name,
        specCategory: classifyHardwareSpec(specNode.name),
        isCritical: isCriticalValue(criticalityLabel),
        criticalityLabel: criticalityLabel || undefined
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
    const thirdPartyHeader = this.findHeader(rows, ["third party", "thrid party", "vendor", "provider"]);

    if (!serviceHeader || !directChannelHeader || !applicationHeader || !thirdPartyHeader) {
      return [];
    }

    const facts = new Map<string, ImportThirdPartyInput>();

    rows.forEach((row, rowIndex) => {
      const serviceValue = this.valueForHeader(row, serviceHeader);
      const directChannelValue = this.valueForHeader(row, directChannelHeader);
      const applicationValue = this.valueForHeader(row, applicationHeader);
      const thirdPartyValue = this.valueForHeader(row, thirdPartyHeader);
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
          datasetId: options.datasetId,
          sourceRowNumber: rowIndex + 2,
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
