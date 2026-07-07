import { Injectable } from "@nestjs/common";
import {
  CANONICAL_NODE_TYPES,
  DEFAULT_DATASET_ID,
  GraphEdge,
  GraphNode,
  GraphResponse,
  GraphStatistics,
  RELATIONSHIP_TYPES,
  SearchResultItem
} from "@service-dependency/shared";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PoolClient } from "pg";
import { normalizeName } from "../../common/utils/text-normalizer";
import { ImportFactInput, ImportHardwareSpecInput, ImportPlan, ImportThirdPartyInput } from "../import/import.types";
import { PostgresService } from "../postgres/postgres.service";

type DependencyRow = {
  service_id: string;
  service_name: string;
  service_normalized_name: string;
  direct_channel_id: string;
  direct_channel_name: string;
  direct_channel_normalized_name: string;
  application_id: string;
  application_name: string;
  application_normalized_name: string;
  integration_id: string;
  integration_name: string;
  integration_normalized_name: string;
  third_party_id: string | null;
  third_party_name: string | null;
  third_party_normalized_name: string | null;
  hardware_spec_id: string | null;
  hardware_spec_name: string | null;
  hardware_spec_normalized_name: string | null;
  hardware_spec_category: string | null;
  hardware_spec_is_critical: boolean | null;
  dataset_id: string;
};

type DimensionRow = {
  id: string;
  name: string;
  normalized_name: string;
  type: string;
  dataset_id: string;
};

@Injectable()
export class GraphRepository {
  constructor(private readonly postgres: PostgresService) {}

  async ensureSchema(): Promise<void> {
    const schemaPath = resolve(process.cwd(), "../infra/sql/init/001_service_dependency_schema.sql");
    const schema = await readFile(schemaPath, "utf8");
    await this.postgres.query(schema);
  }

  async mergeImportPlan(plan: ImportPlan): Promise<void> {
    await this.postgres.transaction(async (client) => {
      await client.query("DELETE FROM import_batch WHERE dataset_id = $1", [plan.datasetId]);
      const importBatchId = await this.insertImportBatch(client, plan);

      for (const fact of plan.facts) {
        await this.insertFact(client, importBatchId, fact);
      }
      for (const hardwareSpec of plan.hardwareSpecs) {
        await this.insertHardwareSpecFact(client, importBatchId, hardwareSpec);
      }
      for (const thirdParty of plan.thirdParties) {
        await this.insertThirdPartyFact(client, importBatchId, thirdParty);
      }
    });
  }

  async getStatistics(datasetId = DEFAULT_DATASET_ID): Promise<GraphStatistics> {
    const result = await this.postgres.query<{ type: string; count: string }>(
      `
      SELECT 'Service' AS type, count(DISTINCT service_id)::text AS count
      FROM fact_service_dependency
      WHERE dataset_id = $1
      UNION ALL
      SELECT 'DirectChannel', count(DISTINCT direct_channel_id)::text
      FROM fact_service_dependency
      WHERE dataset_id = $1
      UNION ALL
      SELECT 'Application', count(DISTINCT application_id)::text
      FROM fact_service_dependency
      WHERE dataset_id = $1
      UNION ALL
      SELECT 'Integration', count(DISTINCT integration_id)::text
      FROM fact_service_dependency
      WHERE dataset_id = $1
      UNION ALL
      SELECT 'ThirdParty', count(DISTINCT third_party_id)::text
      FROM fact_application_third_party
      WHERE dataset_id = $1
      UNION ALL
      SELECT 'HardwareSpec', count(DISTINCT hardware_spec_id)::text
      FROM fact_integration_hardware_spec
      WHERE dataset_id = $1
      ORDER BY type
      `,
      [datasetId]
    );
    const relationshipResult = await this.postgres.query<{ count: string }>(
      `
      SELECT (
        (SELECT count(*) * 3 FROM fact_service_dependency WHERE dataset_id = $1) +
        (SELECT count(*) FROM fact_application_third_party WHERE dataset_id = $1) +
        (SELECT count(*) FROM fact_integration_hardware_spec WHERE dataset_id = $1)
      )::text AS count
      `,
      [datasetId]
    );
    const nodesByType = Object.fromEntries(result.rows.map((row) => [row.type, Number(row.count)]));
    const totalNodes = Object.values(nodesByType).reduce((sum, count) => sum + count, 0);
    const totalRelationships = Number(relationshipResult.rows[0]?.count ?? 0);

    return { totalNodes, totalRelationships, nodesByType };
  }

  async search(query: string, datasetId = DEFAULT_DATASET_ID, limit = 20): Promise<SearchResultItem[]> {
    const normalizedQuery = normalizeName(query);
    const result = await this.postgres.query<DimensionRow>(
      `
      SELECT * FROM (
        SELECT service_id::text AS id, service_name AS name, normalized_name, 'Service' AS type, $2::text AS dataset_id
        FROM dim_service
        WHERE $1 = '' OR normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT direct_channel_id::text, direct_channel_name, normalized_name, 'DirectChannel', $2::text
        FROM dim_direct_channel
        WHERE $1 = '' OR normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT application_id::text, application_name, normalized_name, 'Application', $2::text
        FROM dim_application
        WHERE $1 = '' OR normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT integration_id::text, integration_name, normalized_name, 'Integration', $2::text
        FROM dim_integration
        WHERE $1 = '' OR normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT third_party_id::text, third_party_name, normalized_name, 'ThirdParty', $2::text
        FROM dim_third_party
        WHERE $1 = '' OR normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT hardware_spec_id::text, spec_name, normalized_name, 'HardwareSpec', $2::text
        FROM dim_hardware_spec
        WHERE $1 = '' OR normalized_name LIKE '%' || $1 || '%'
      ) AS results
      ORDER BY type, name
      LIMIT $3
      `,
      [normalizedQuery, datasetId, limit]
    );

    return result.rows.map(toSearchResult);
  }

  async listByType(type: string, datasetId = DEFAULT_DATASET_ID, limit = 1000): Promise<SearchResultItem[]> {
    const table = tableForType(type);
    const idColumn = idColumnForType(type);
    const nameColumn = nameColumnForType(type);
    const result = await this.postgres.query<DimensionRow>(
      `
      SELECT ${idColumn}::text AS id, ${nameColumn} AS name, normalized_name, $1::text AS type, $2::text AS dataset_id
      FROM ${table}
      ORDER BY ${nameColumn}
      LIMIT $3
      `,
      [type, datasetId, limit]
    );

    return result.rows.map(toSearchResult);
  }

  async getServiceDependencies(name: string, datasetId = DEFAULT_DATASET_ID): Promise<GraphResponse> {
    const rows = await this.getDependencyRows(datasetId, normalizeName(name));
    return rows.length > 0 ? rowsToServiceGraph(rows) : { nodes: [], edges: [] };
  }

  async getNeighbors(entityKey: string): Promise<GraphResponse> {
    const [type, id] = entityKey.split(":");
    if (!type || !id) {
      return { nodes: [], edges: [] };
    }

    const rows = await this.getRowsForEntity(type, Number(id));
    return rows.length > 0 ? rowsToServiceGraph(rows) : { nodes: [], edges: [] };
  }

  async getImpactGraph(type: string, name: string, datasetId = DEFAULT_DATASET_ID): Promise<GraphResponse> {
    const rows = await this.getImpactRows(type, normalizeName(name), datasetId);
    if (rows.length === 0) {
      return { nodes: [], edges: [] };
    }

    return rowsToImpactGraph(rows, type, normalizeName(name));
  }

  async getNode(entityKey: string): Promise<GraphNode | null> {
    const [type, id] = entityKey.split(":");
    if (!type || !id) {
      return null;
    }
    const table = tableForType(type);
    const idColumn = idColumnForType(type);
    const nameColumn = nameColumnForType(type);
    const result = await this.postgres.query<DimensionRow>(
      `
      SELECT ${idColumn}::text AS id, ${nameColumn} AS name, normalized_name, $1::text AS type, $2::text AS dataset_id
      FROM ${table}
      WHERE ${idColumn} = $3
      `,
      [type, DEFAULT_DATASET_ID, Number(id)]
    );
    const row = result.rows[0];
    return row ? dimensionRowToGraphNode(row) : null;
  }

  private async insertImportBatch(client: PoolClient, plan: ImportPlan): Promise<string> {
    const result = await client.query<{ import_batch_id: string }>(
      `
      INSERT INTO import_batch (
        import_batch_id,
        dataset_id,
        source_file,
        source_sheet,
        rows_read,
        rows_imported
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING import_batch_id::text
      `,
      [plan.importId, plan.datasetId, plan.sourceName, plan.sheetName, plan.rowsRead, plan.rowsImported]
    );
    return result.rows[0].import_batch_id;
  }

  private async insertFact(client: PoolClient, importBatchId: string, fact: ImportFactInput): Promise<void> {
    const functionId = fact.functionName ? await upsertDimension(client, "dim_function", "function", fact.functionName) : null;
    const serviceId = await upsertDimension(client, "dim_service", "service", fact.serviceName);
    const directChannelId = await upsertDimension(client, "dim_direct_channel", "direct_channel", fact.directChannelName);
    const applicationId = await upsertDimension(client, "dim_application", "application", fact.applicationName);
    const integrationId = await upsertDimension(client, "dim_integration", "integration", fact.integrationName);

    await client.query(
      `
      INSERT INTO fact_service_dependency (
        import_batch_id,
        dataset_id,
        source_row_number,
        function_id,
        service_id,
        direct_channel_id,
        application_id,
        integration_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (
        dataset_id,
        service_id,
        direct_channel_id,
        application_id,
        integration_id
      )
      DO UPDATE SET
        import_batch_id = EXCLUDED.import_batch_id,
        source_row_number = EXCLUDED.source_row_number,
        function_id = EXCLUDED.function_id
      `,
      [
        importBatchId,
        fact.datasetId,
        fact.sourceRowNumber,
        functionId,
        serviceId,
        directChannelId,
        applicationId,
        integrationId
      ]
    );
  }

  private async insertHardwareSpecFact(
    client: PoolClient,
    importBatchId: string,
    hardwareSpec: ImportHardwareSpecInput
  ): Promise<void> {
    const integrationId = await upsertDimension(client, "dim_integration", "integration", hardwareSpec.integrationName);
    const hardwareSpecId = await upsertHardwareSpecDimension(client, hardwareSpec.specName, hardwareSpec.specCategory);

    await client.query(
      `
      INSERT INTO fact_integration_hardware_spec (
        import_batch_id,
        dataset_id,
        source_row_number,
        integration_id,
        hardware_spec_id,
        is_critical,
        criticality_label
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (
        dataset_id,
        integration_id,
        hardware_spec_id
      )
      DO UPDATE SET
        import_batch_id = EXCLUDED.import_batch_id,
        source_row_number = EXCLUDED.source_row_number,
        is_critical = EXCLUDED.is_critical,
        criticality_label = EXCLUDED.criticality_label
      `,
      [
        importBatchId,
        hardwareSpec.datasetId,
        hardwareSpec.sourceRowNumber,
        integrationId,
        hardwareSpecId,
        hardwareSpec.isCritical,
        hardwareSpec.criticalityLabel ?? null
      ]
    );
  }

  private async insertThirdPartyFact(
    client: PoolClient,
    importBatchId: string,
    thirdParty: ImportThirdPartyInput
  ): Promise<void> {
    const functionId = thirdParty.functionName ? await upsertDimension(client, "dim_function", "function", thirdParty.functionName) : null;
    const serviceId = await upsertDimension(client, "dim_service", "service", thirdParty.serviceName);
    const directChannelId = await upsertDimension(client, "dim_direct_channel", "direct_channel", thirdParty.directChannelName);
    const applicationId = await upsertDimension(client, "dim_application", "application", thirdParty.applicationName);
    const thirdPartyId = await upsertDimension(client, "dim_third_party", "third_party", thirdParty.thirdPartyName);

    await client.query(
      `
      INSERT INTO fact_application_third_party (
        import_batch_id,
        dataset_id,
        source_row_number,
        function_id,
        service_id,
        direct_channel_id,
        application_id,
        third_party_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (
        dataset_id,
        service_id,
        direct_channel_id,
        application_id,
        third_party_id
      )
      DO UPDATE SET
        import_batch_id = EXCLUDED.import_batch_id,
        source_row_number = EXCLUDED.source_row_number,
        function_id = EXCLUDED.function_id
      `,
      [
        importBatchId,
        thirdParty.datasetId,
        thirdParty.sourceRowNumber,
        functionId,
        serviceId,
        directChannelId,
        applicationId,
        thirdPartyId
      ]
    );
  }

  private async getDependencyRows(datasetId: string, serviceName: string): Promise<DependencyRow[]> {
    const result = await this.postgres.query<DependencyRow>(
      `
      SELECT
        s.service_id::text,
        s.service_name,
        s.normalized_name AS service_normalized_name,
        dc.direct_channel_id::text,
        dc.direct_channel_name,
        dc.normalized_name AS direct_channel_normalized_name,
        app.application_id::text,
        app.application_name,
        app.normalized_name AS application_normalized_name,
        integ.integration_id::text,
        integ.integration_name,
        integ.normalized_name AS integration_normalized_name,
        tp.third_party_id::text,
        tp.third_party_name,
        tp.normalized_name AS third_party_normalized_name,
        hw.hardware_spec_id::text,
        hw.spec_name AS hardware_spec_name,
        hw.normalized_name AS hardware_spec_normalized_name,
        hw.spec_category AS hardware_spec_category,
        ihs.is_critical AS hardware_spec_is_critical,
        f.dataset_id
      FROM fact_service_dependency f
      JOIN dim_service s ON s.service_id = f.service_id
      JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
      JOIN dim_application app ON app.application_id = f.application_id
      JOIN dim_integration integ ON integ.integration_id = f.integration_id
      LEFT JOIN fact_application_third_party atp
        ON atp.dataset_id = f.dataset_id
       AND atp.service_id = f.service_id
       AND atp.direct_channel_id = f.direct_channel_id
       AND atp.application_id = f.application_id
      LEFT JOIN dim_third_party tp ON tp.third_party_id = atp.third_party_id
      LEFT JOIN fact_integration_hardware_spec ihs
        ON ihs.dataset_id = f.dataset_id
       AND ihs.integration_id = f.integration_id
      LEFT JOIN dim_hardware_spec hw ON hw.hardware_spec_id = ihs.hardware_spec_id
      WHERE f.dataset_id = $1 AND s.normalized_name = $2
      ORDER BY dc.direct_channel_name, app.application_name, integ.integration_name, tp.third_party_name, hw.spec_category, hw.spec_name
      `,
      [datasetId, serviceName]
    );
    return result.rows;
  }

  private async getRowsForEntity(type: string, id: number): Promise<DependencyRow[]> {
    const filterColumn = factColumnForType(type);
    const result = await this.postgres.query<DependencyRow>(
      `
      SELECT
        s.service_id::text,
        s.service_name,
        s.normalized_name AS service_normalized_name,
        dc.direct_channel_id::text,
        dc.direct_channel_name,
        dc.normalized_name AS direct_channel_normalized_name,
        app.application_id::text,
        app.application_name,
        app.normalized_name AS application_normalized_name,
        integ.integration_id::text,
        integ.integration_name,
        integ.normalized_name AS integration_normalized_name,
        NULL::text AS third_party_id,
        NULL::text AS third_party_name,
        NULL::text AS third_party_normalized_name,
        NULL::text AS hardware_spec_id,
        NULL::text AS hardware_spec_name,
        NULL::text AS hardware_spec_normalized_name,
        NULL::text AS hardware_spec_category,
        NULL::boolean AS hardware_spec_is_critical,
        f.dataset_id
      FROM fact_service_dependency f
      JOIN dim_service s ON s.service_id = f.service_id
      JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
      JOIN dim_application app ON app.application_id = f.application_id
      JOIN dim_integration integ ON integ.integration_id = f.integration_id
      WHERE f.${filterColumn} = $1
      ORDER BY s.service_name, dc.direct_channel_name, app.application_name, integ.integration_name
      `,
      [id]
    );
    return result.rows;
  }

  private async getImpactRows(type: string, normalizedName: string, datasetId: string): Promise<DependencyRow[]> {
    const table = tableForType(type);
    const idColumn = idColumnForType(type);
    const nameColumn = nameColumnForType(type);
    const factColumn = factColumnForType(type);
    const result = await this.postgres.query<DependencyRow>(
      `
      SELECT
        s.service_id::text,
        s.service_name,
        s.normalized_name AS service_normalized_name,
        dc.direct_channel_id::text,
        dc.direct_channel_name,
        dc.normalized_name AS direct_channel_normalized_name,
        app.application_id::text,
        app.application_name,
        app.normalized_name AS application_normalized_name,
        integ.integration_id::text,
        integ.integration_name,
        integ.normalized_name AS integration_normalized_name,
        tp.third_party_id::text,
        tp.third_party_name,
        tp.normalized_name AS third_party_normalized_name,
        hw.hardware_spec_id::text,
        hw.spec_name AS hardware_spec_name,
        hw.normalized_name AS hardware_spec_normalized_name,
        hw.spec_category AS hardware_spec_category,
        ihs.is_critical AS hardware_spec_is_critical,
        f.dataset_id
      FROM fact_service_dependency f
      JOIN ${table} selected ON selected.${idColumn} = f.${factColumn}
      JOIN dim_service s ON s.service_id = f.service_id
      JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
      JOIN dim_application app ON app.application_id = f.application_id
      JOIN dim_integration integ ON integ.integration_id = f.integration_id
      LEFT JOIN fact_application_third_party atp
        ON atp.dataset_id = f.dataset_id
       AND atp.service_id = f.service_id
       AND atp.direct_channel_id = f.direct_channel_id
       AND atp.application_id = f.application_id
      LEFT JOIN dim_third_party tp ON tp.third_party_id = atp.third_party_id
      LEFT JOIN fact_integration_hardware_spec ihs
        ON ihs.dataset_id = f.dataset_id
       AND ihs.integration_id = f.integration_id
      LEFT JOIN dim_hardware_spec hw ON hw.hardware_spec_id = ihs.hardware_spec_id
      WHERE f.dataset_id = $1 AND selected.normalized_name = $2
      ORDER BY s.service_name, dc.direct_channel_name, app.application_name, integ.integration_name, tp.third_party_name, hw.spec_category, hw.spec_name
      `,
      [datasetId, normalizedName]
    );
    void nameColumn;
    return result.rows;
  }
}

async function upsertDimension(client: PoolClient, table: string, prefix: string, name: string): Promise<number> {
  const idColumn = `${prefix}_id`;
  const nameColumn = `${prefix}_name`;
  const result = await client.query<{ id: number }>(
    `
    INSERT INTO ${table} (${nameColumn}, normalized_name)
    VALUES ($1, $2)
    ON CONFLICT (normalized_name)
    DO UPDATE SET
      ${nameColumn} = EXCLUDED.${nameColumn},
      updated_at = now()
    RETURNING ${idColumn} AS id
    `,
    [name, normalizeName(name)]
  );
  return result.rows[0].id;
}

async function upsertHardwareSpecDimension(client: PoolClient, name: string, category: string): Promise<number> {
  const result = await client.query<{ id: number }>(
    `
    INSERT INTO dim_hardware_spec (spec_name, spec_category, normalized_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (normalized_name)
    DO UPDATE SET
      spec_name = EXCLUDED.spec_name,
      spec_category = EXCLUDED.spec_category,
      updated_at = now()
    RETURNING hardware_spec_id AS id
    `,
    [name, category, normalizeName(name)]
  );
  return result.rows[0].id;
}

function rowsToServiceGraph(rows: DependencyRow[]): GraphResponse {
  const first = rows[0];
  const rootId = `Service:${first.service_id}`;
  const nodeProperties = createServiceNodeProperties(rows, rootId);
  const nodes = new Map<string, GraphNode>([
    [
      rootId,
      {
        id: rootId,
        entityKey: rootId,
        type: CANONICAL_NODE_TYPES.SERVICE,
        label: first.service_name,
        name: first.service_name,
        normalizedName: first.service_normalized_name,
        datasetId: first.dataset_id,
        properties: nodeProperties.get(rootId)
      }
    ]
  ]);
  const edges = new Map<string, GraphEdge>();

  for (const row of rows) {
    const directChannelId = `${rootId}/DirectChannel:${row.direct_channel_id}`;
    const applicationId = `${directChannelId}/Application:${row.application_id}`;
    const integrationId = `${directChannelId}/Integration:${row.integration_id}`;

    nodes.set(directChannelId, toVirtualNode(directChannelId, `DirectChannel:${row.direct_channel_id}`, CANONICAL_NODE_TYPES.DIRECT_CHANNEL, row.direct_channel_name, row.direct_channel_normalized_name, row.dataset_id, nodeProperties.get(directChannelId)));
    nodes.set(applicationId, toVirtualNode(applicationId, `Application:${row.application_id}`, CANONICAL_NODE_TYPES.APPLICATION, row.application_name, row.application_normalized_name, row.dataset_id, nodeProperties.get(applicationId)));
    nodes.set(integrationId, toVirtualNode(integrationId, `Integration:${row.integration_id}`, CANONICAL_NODE_TYPES.INTEGRATION, row.integration_name, row.integration_normalized_name, row.dataset_id, nodeProperties.get(integrationId)));

    addEdge(edges, rootId, directChannelId, RELATIONSHIP_TYPES.AVAILABLE_ON);
    addEdge(edges, directChannelId, applicationId, RELATIONSHIP_TYPES.DEPENDS_ON);
    addEdge(edges, applicationId, integrationId, RELATIONSHIP_TYPES.DEPENDS_ON);
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    rootNodeId: rootId
  };
}

function rowsToImpactGraph(rows: DependencyRow[], type: string, normalizedName: string): GraphResponse {
  const selected = rows.find((row) =>
    type === CANONICAL_NODE_TYPES.INTEGRATION
      ? row.integration_normalized_name === normalizedName
      : row.application_normalized_name === normalizedName
  );
  if (!selected) {
    return { nodes: [], edges: [] };
  }

  const rootId =
    type === CANONICAL_NODE_TYPES.INTEGRATION
      ? `Integration:${selected.integration_id}`
      : `Application:${selected.application_id}`;
  const nodes = new Map<string, GraphNode>([
    [
      rootId,
      type === CANONICAL_NODE_TYPES.INTEGRATION
        ? toVirtualNode(
            rootId,
            rootId,
            CANONICAL_NODE_TYPES.INTEGRATION,
            selected.integration_name,
            selected.integration_normalized_name,
            selected.dataset_id
          )
        : toVirtualNode(
            rootId,
            rootId,
            CANONICAL_NODE_TYPES.APPLICATION,
            selected.application_name,
            selected.application_normalized_name,
            selected.dataset_id
          )
    ]
  ]);
  const edges = new Map<string, GraphEdge>();

  for (const row of rows) {
    const serviceId = `Service:${row.service_id}`;
    const directChannelId = `DirectChannel:${row.direct_channel_id}`;
    const applicationId = `Application:${row.application_id}`;
    const integrationId = `Integration:${row.integration_id}`;

    nodes.set(serviceId, toVirtualNode(serviceId, serviceId, CANONICAL_NODE_TYPES.SERVICE, row.service_name, row.service_normalized_name, row.dataset_id));
    nodes.set(directChannelId, toVirtualNode(directChannelId, directChannelId, CANONICAL_NODE_TYPES.DIRECT_CHANNEL, row.direct_channel_name, row.direct_channel_normalized_name, row.dataset_id));
    if (type === CANONICAL_NODE_TYPES.INTEGRATION) {
      nodes.set(applicationId, toVirtualNode(applicationId, applicationId, CANONICAL_NODE_TYPES.APPLICATION, row.application_name, row.application_normalized_name, row.dataset_id));
      addEdge(edges, rootId, applicationId, "IMPACTS");
      addEdge(edges, applicationId, directChannelId, "IMPACTS");
    } else {
      nodes.set(integrationId, toVirtualNode(integrationId, integrationId, CANONICAL_NODE_TYPES.INTEGRATION, row.integration_name, row.integration_normalized_name, row.dataset_id));
      addEdge(edges, rootId, integrationId, "DEPENDS_ON");
      addEdge(edges, integrationId, directChannelId, "IMPACTS");
    }
    addEdge(edges, directChannelId, serviceId, "IMPACTS");
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    rootNodeId: rootId
  };
}

function createServiceNodeProperties(rows: DependencyRow[], rootId: string): Map<string, Record<string, unknown>> {
  const properties = new Map<string, Record<string, unknown>>();
  const serviceChannels = new Set<string>();

  for (const row of rows) {
    const directChannelId = `${rootId}/DirectChannel:${row.direct_channel_id}`;
    const applicationId = `${directChannelId}/Application:${row.application_id}`;
    const integrationId = `${directChannelId}/Integration:${row.integration_id}`;

    serviceChannels.add(row.direct_channel_name);
    addPropertyValue(properties, rootId, "directChannels", row.direct_channel_name);
    addPropertyValue(properties, rootId, "applications", row.application_name);
    addPropertyValue(properties, rootId, "integrations", row.integration_name);

    addPropertyValue(properties, directChannelId, "applications", row.application_name);
    addPropertyValue(properties, directChannelId, "integrations", row.integration_name);

    addPropertyValue(properties, applicationId, "directChannel", row.direct_channel_name);
    addPropertyValue(properties, applicationId, "integrations", row.integration_name);
    if (row.third_party_name) {
      addPropertyValue(properties, applicationId, "thirdParties", row.third_party_name);
    }

    addPropertyValue(properties, integrationId, "directChannel", row.direct_channel_name);
    addPropertyValue(properties, integrationId, "applications", row.application_name);
    if (row.hardware_spec_name) {
      addPropertyValue(properties, integrationId, "hardwareSpecs", formatHardwareSpec(row));
    }
    if (row.hardware_spec_is_critical && row.hardware_spec_name) {
      addPropertyValue(properties, integrationId, "criticalHardwareSpecs", formatHardwareSpec(row));
    }
  }

  properties.set(rootId, {
    ...(properties.get(rootId) ?? {}),
    directChannelCount: serviceChannels.size
  });
  return properties;
}

function addPropertyValue(properties: Map<string, Record<string, unknown>>, nodeId: string, key: string, value: string) {
  const current = properties.get(nodeId) ?? {};
  const values = Array.isArray(current[key]) ? (current[key] as string[]) : [];
  if (!values.includes(value)) {
    properties.set(nodeId, { ...current, [key]: [...values, value].sort((left, right) => left.localeCompare(right)) });
  }
}

function formatHardwareSpec(row: DependencyRow): string {
  return row.hardware_spec_category ? `${row.hardware_spec_category}: ${row.hardware_spec_name}` : String(row.hardware_spec_name);
}

function toVirtualNode(
  id: string,
  entityKey: string,
  type: string,
  name: string,
  normalizedName: string,
  datasetId: string,
  properties?: Record<string, unknown>
): GraphNode {
  return {
    id,
    entityKey,
    type,
    label: name,
    name,
    normalizedName,
    datasetId,
    properties
  };
}

function addEdge(edges: Map<string, GraphEdge>, source: string, target: string, type: string, properties?: Record<string, unknown>) {
  const id = `${source}:${type}:${target}`;
  edges.set(id, {
    id,
    source,
    target,
    type,
    label: type.replaceAll("_", " "),
    properties
  });
}

function toSearchResult(row: DimensionRow): SearchResultItem {
  return {
    entityKey: `${row.type}:${row.id}`,
    name: row.name,
    normalizedName: row.normalized_name,
    type: row.type,
    datasetId: row.dataset_id
  };
}

function dimensionRowToGraphNode(row: DimensionRow): GraphNode {
  return {
    id: `${row.type}:${row.id}`,
    entityKey: `${row.type}:${row.id}`,
    type: row.type,
    label: row.name,
    name: row.name,
    normalizedName: row.normalized_name,
    datasetId: row.dataset_id
  };
}

function tableForType(type: string): string {
  if (type === CANONICAL_NODE_TYPES.SERVICE) return "dim_service";
  if (type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL) return "dim_direct_channel";
  if (type === CANONICAL_NODE_TYPES.APPLICATION) return "dim_application";
  if (type === CANONICAL_NODE_TYPES.INTEGRATION) return "dim_integration";
  if (type === CANONICAL_NODE_TYPES.FUNCTION) return "dim_function";
  if (type === CANONICAL_NODE_TYPES.THIRD_PARTY) return "dim_third_party";
  if (type === CANONICAL_NODE_TYPES.HARDWARE_SPEC) return "dim_hardware_spec";
  throw new Error(`Unsupported node type: ${type}`);
}

function idColumnForType(type: string): string {
  if (type === CANONICAL_NODE_TYPES.SERVICE) return "service_id";
  if (type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL) return "direct_channel_id";
  if (type === CANONICAL_NODE_TYPES.APPLICATION) return "application_id";
  if (type === CANONICAL_NODE_TYPES.INTEGRATION) return "integration_id";
  if (type === CANONICAL_NODE_TYPES.FUNCTION) return "function_id";
  if (type === CANONICAL_NODE_TYPES.THIRD_PARTY) return "third_party_id";
  if (type === CANONICAL_NODE_TYPES.HARDWARE_SPEC) return "hardware_spec_id";
  throw new Error(`Unsupported node type: ${type}`);
}

function nameColumnForType(type: string): string {
  if (type === CANONICAL_NODE_TYPES.SERVICE) return "service_name";
  if (type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL) return "direct_channel_name";
  if (type === CANONICAL_NODE_TYPES.APPLICATION) return "application_name";
  if (type === CANONICAL_NODE_TYPES.INTEGRATION) return "integration_name";
  if (type === CANONICAL_NODE_TYPES.FUNCTION) return "function_name";
  if (type === CANONICAL_NODE_TYPES.THIRD_PARTY) return "third_party_name";
  if (type === CANONICAL_NODE_TYPES.HARDWARE_SPEC) return "spec_name";
  throw new Error(`Unsupported node type: ${type}`);
}

function factColumnForType(type: string): string {
  if (type === CANONICAL_NODE_TYPES.SERVICE) return "service_id";
  if (type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL) return "direct_channel_id";
  if (type === CANONICAL_NODE_TYPES.APPLICATION) return "application_id";
  if (type === CANONICAL_NODE_TYPES.INTEGRATION) return "integration_id";
  if (type === CANONICAL_NODE_TYPES.FUNCTION) return "function_id";
  throw new Error(`Unsupported node type: ${type}`);
}
