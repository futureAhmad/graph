import { Injectable } from "@nestjs/common";
import {
  CANONICAL_NODE_TYPES,
  DEFAULT_DATASET_ID,
  ExecutiveDashboardResponse,
  GraphEdge,
  GraphNode,
  GraphResponse,
  GraphStatistics,
  RELATIONSHIP_TYPES,
  SearchResultItem
} from "../../shared";
import { PoolClient } from "pg";
import { normalizeName } from "../../common/utils/text-normalizer";
import { ImportFactInput, ImportHardwareSpecInput, ImportPlan, ImportThirdPartyInput } from "../import/import.types";
import { PostgresService } from "../postgres/postgres.service";
import {
  buildExecutiveInsights,
  buildSummary,
  classifyApplications,
  classifyThirdParties,
  percentage
} from "./executive-dashboard.analytics";

type DependencyRow = {
  service_id: string;
  service_name: string;
  service_normalized_name: string;
  service_is_critical: boolean;
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
  hardware_source_type: string | null;
};

type DimensionRow = {
  id: string;
  context_key?: string | null;
  context_label?: string | null;
  service_name?: string | null;
  name: string;
  normalized_name: string;
  type: string;
};

@Injectable()
export class GraphRepository {
  constructor(private readonly postgres: PostgresService) {}

  async mergeImportPlan(plan: ImportPlan): Promise<void> {
    await this.postgres.transaction(async (client) => {
      await this.clearImportedData(client);

      for (const fact of plan.facts) {
        await this.insertFact(client, fact);
      }
      for (const hardwareSpec of plan.hardwareSpecs) {
        await this.insertHardwareSpecFact(client, hardwareSpec);
      }
      for (const thirdParty of plan.thirdParties) {
        await this.insertThirdPartyFact(client, thirdParty);
      }
    });
  }

  async deleteImportedData(): Promise<{ deleted: true }> {
    await this.postgres.transaction(async (client) => {
      await this.clearImportedData(client);
    });
    return { deleted: true };
  }

  async getStatistics(datasetId = DEFAULT_DATASET_ID): Promise<GraphStatistics> {
    void datasetId;
    const result = await this.postgres.query<{ type: string; count: string }>(
      `
      SELECT 'Service' AS type, count(DISTINCT service_id)::text AS count
      FROM fact_service_dependency
      UNION ALL
      SELECT 'DirectChannel', count(DISTINCT direct_channel_id)::text
      FROM fact_service_dependency
      UNION ALL
      SELECT 'Application', count(DISTINCT application_id)::text
      FROM fact_service_dependency
      UNION ALL
      SELECT 'Integration', count(DISTINCT integration_id)::text
      FROM fact_service_dependency
      UNION ALL
      SELECT 'ThirdParty', count(DISTINCT third_party_id)::text
      FROM fact_application_third_party
      UNION ALL
      SELECT 'HardwareSpec', count(DISTINCT hardware_spec_id)::text
      FROM fact_integration_hardware_spec
      ORDER BY type
      `
    );
    const relationshipResult = await this.postgres.query<{ count: string }>(
      `
      SELECT (
        (SELECT count(*) * 3 FROM fact_service_dependency) +
        (SELECT count(*) FROM fact_application_third_party) +
        (SELECT count(*) FROM fact_integration_hardware_spec)
      )::text AS count
      `
    );
    const criticalServicesResult = await this.postgres.query<{ critical: string; non_critical: string }>(
      `
      WITH service_flags AS (
        SELECT service_id, bool_or(is_critical) AS is_critical
        FROM fact_service_dependency
        GROUP BY service_id
      )
      SELECT
        count(*) FILTER (WHERE is_critical)::text AS critical,
        count(*) FILTER (WHERE NOT is_critical)::text AS non_critical
      FROM service_flags
      `
    );
    const thirdPartyExposureResult = await this.postgres.query<{
      total_third_parties: string;
      applications_with_third_party: string;
      applications_without_third_party: string;
    }>(
      `
      SELECT
        (SELECT count(DISTINCT third_party_id) FROM fact_application_third_party)::text AS total_third_parties,
        count(DISTINCT f.application_id) FILTER (WHERE atp.application_id IS NOT NULL)::text AS applications_with_third_party,
        count(DISTINCT f.application_id) FILTER (WHERE atp.application_id IS NULL)::text AS applications_without_third_party
      FROM fact_service_dependency f
      LEFT JOIN fact_application_third_party atp ON atp.application_id = f.application_id
      `
    );
    const hardwareCriticalityResult = await this.postgres.query<{ critical: string; non_critical: string }>(
      `
      SELECT
        count(*) FILTER (WHERE is_critical)::text AS critical,
        count(*) FILTER (WHERE NOT is_critical)::text AS non_critical
      FROM fact_integration_hardware_spec
      `
    );
    const hardwareCategoryResult = await this.postgres.query<{ category: string; critical: string; non_critical: string }>(
      `
      SELECT
        hw.spec_category AS category,
        count(*) FILTER (WHERE f.is_critical)::text AS critical,
        count(*) FILTER (WHERE NOT f.is_critical)::text AS non_critical
      FROM fact_integration_hardware_spec f
      JOIN dim_hardware_spec hw ON hw.hardware_spec_id = f.hardware_spec_id
      GROUP BY hw.spec_category
      ORDER BY (count(*) FILTER (WHERE f.is_critical)) DESC, count(*) DESC, hw.spec_category
      `
    );
    const topThirdPartiesResult = await this.postgres.query<{ name: string; applications: string; services: string }>(
      `
      SELECT
        tp.third_party_name AS name,
        count(DISTINCT f.application_id)::text AS applications,
        count(DISTINCT f.service_id)::text AS services
      FROM fact_application_third_party f
      JOIN dim_third_party tp ON tp.third_party_id = f.third_party_id
      GROUP BY tp.third_party_id, tp.third_party_name
      ORDER BY count(DISTINCT f.application_id) DESC, count(DISTINCT f.service_id) DESC, tp.third_party_name
      LIMIT 8
      `
    );
    const topCriticalServicesResult = await this.postgres.query<{
      name: string;
      channels: string;
      applications: string;
      integrations: string;
    }>(
      `
      SELECT
        s.service_name AS name,
        count(DISTINCT f.direct_channel_id)::text AS channels,
        count(DISTINCT f.application_id)::text AS applications,
        count(DISTINCT f.integration_id)::text AS integrations
      FROM fact_service_dependency f
      JOIN dim_service s ON s.service_id = f.service_id
      GROUP BY s.service_id, s.service_name
      HAVING bool_or(f.is_critical)
      ORDER BY count(DISTINCT f.integration_id) DESC, count(DISTINCT f.application_id) DESC, s.service_name
      LIMIT 8
      `
    );
    const serviceRiskMapResult = await this.postgres.query<{
      name: string;
      channels: string;
      applications: string;
      integrations: string;
      is_critical: boolean;
    }>(
      `
      SELECT
        s.service_name AS name,
        count(DISTINCT f.direct_channel_id)::text AS channels,
        count(DISTINCT f.application_id)::text AS applications,
        count(DISTINCT f.integration_id)::text AS integrations,
        bool_or(f.is_critical) AS is_critical
      FROM fact_service_dependency f
      JOIN dim_service s ON s.service_id = f.service_id
      GROUP BY s.service_id, s.service_name
      ORDER BY bool_or(f.is_critical) DESC, count(DISTINCT f.integration_id) DESC, count(DISTINCT f.application_id) DESC, s.service_name
      LIMIT 40
      `
    );
    const functionPortfolioResult = await this.postgres.query<{
      name: string;
      services: string;
      critical_services: string;
      applications: string;
      integrations: string;
      third_parties: string;
    }>(
      `
      SELECT
        COALESCE(fn.function_name, 'Unassigned') AS name,
        count(DISTINCT f.service_id)::text AS services,
        count(DISTINCT f.service_id) FILTER (WHERE service_flags.is_critical)::text AS critical_services,
        count(DISTINCT f.application_id)::text AS applications,
        count(DISTINCT f.integration_id)::text AS integrations,
        count(DISTINCT atp.third_party_id)::text AS third_parties
      FROM fact_service_dependency f
      LEFT JOIN dim_function fn ON fn.function_id = f.function_id
      JOIN (
        SELECT service_id, bool_or(is_critical) AS is_critical
        FROM fact_service_dependency
        GROUP BY service_id
      ) service_flags ON service_flags.service_id = f.service_id
      LEFT JOIN fact_application_third_party atp
        ON atp.service_id = f.service_id
       AND atp.direct_channel_id = f.direct_channel_id
       AND atp.application_id = f.application_id
      GROUP BY COALESCE(fn.function_name, 'Unassigned')
      ORDER BY count(DISTINCT f.service_id) DESC, COALESCE(fn.function_name, 'Unassigned')
      `
    );
    const channelPortfolioResult = await this.postgres.query<{
      name: string;
      services: string;
      applications: string;
      integrations: string;
      paths: string;
    }>(
      `
      SELECT
        dc.direct_channel_name AS name,
        count(DISTINCT f.service_id)::text AS services,
        count(DISTINCT f.application_id)::text AS applications,
        count(DISTINCT f.integration_id)::text AS integrations,
        count(*)::text AS paths
      FROM fact_service_dependency f
      JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
      GROUP BY dc.direct_channel_id, dc.direct_channel_name
      ORDER BY count(*) DESC, dc.direct_channel_name
      `
    );
    const applicationComplexityResult = await this.postgres.query<{ bucket: string; applications: string }>(
      `
      WITH app_complexity AS (
        SELECT application_id, count(DISTINCT integration_id) AS integration_count
        FROM fact_service_dependency
        GROUP BY application_id
      ),
      buckets AS (
        SELECT
          CASE
            WHEN integration_count <= 3 THEN '1-3 integrations'
            WHEN integration_count <= 7 THEN '4-7 integrations'
            WHEN integration_count <= 12 THEN '8-12 integrations'
            WHEN integration_count <= 20 THEN '13-20 integrations'
            ELSE '21+ integrations'
          END AS bucket
        FROM app_complexity
      )
      SELECT
        bucket,
        count(*)::text AS applications
      FROM buckets
      GROUP BY bucket
      ORDER BY
        CASE bucket
          WHEN '1-3 integrations' THEN 1
          WHEN '4-7 integrations' THEN 2
          WHEN '8-12 integrations' THEN 3
          WHEN '13-20 integrations' THEN 4
          ELSE 5
        END
      `
    );
    const thirdPartyByFunctionResult = await this.postgres.query<{
      name: string;
      third_parties: string;
      applications: string;
    }>(
      `
      SELECT
        COALESCE(fn.function_name, 'Unassigned') AS name,
        count(DISTINCT atp.third_party_id)::text AS third_parties,
        count(DISTINCT atp.application_id)::text AS applications
      FROM fact_application_third_party atp
      LEFT JOIN dim_function fn ON fn.function_id = atp.function_id
      GROUP BY COALESCE(fn.function_name, 'Unassigned')
      ORDER BY count(DISTINCT atp.third_party_id) DESC, count(DISTINCT atp.application_id) DESC, COALESCE(fn.function_name, 'Unassigned')
      `
    );
    const nodesByType = Object.fromEntries(result.rows.map((row) => [row.type, Number(row.count)]));
    const totalNodes = Object.values(nodesByType).reduce((sum, count) => sum + count, 0);
    const totalRelationships = Number(relationshipResult.rows[0]?.count ?? 0);
    const criticalServices = criticalServicesResult.rows[0] ?? { critical: "0", non_critical: "0" };
    const thirdPartyExposure = thirdPartyExposureResult.rows[0] ?? {
      total_third_parties: "0",
      applications_with_third_party: "0",
      applications_without_third_party: "0"
    };
    const hardwareCriticality = hardwareCriticalityResult.rows[0] ?? { critical: "0", non_critical: "0" };

    return {
      totalNodes,
      totalRelationships,
      nodesByType,
      criticalServices: {
        critical: Number(criticalServices.critical),
        nonCritical: Number(criticalServices.non_critical)
      },
      thirdPartyExposure: {
        totalThirdParties: Number(thirdPartyExposure.total_third_parties),
        applicationsWithThirdParty: Number(thirdPartyExposure.applications_with_third_party),
        applicationsWithoutThirdParty: Number(thirdPartyExposure.applications_without_third_party)
      },
      hardwareCriticality: {
        critical: Number(hardwareCriticality.critical),
        nonCritical: Number(hardwareCriticality.non_critical),
        byCategory: hardwareCategoryResult.rows.map((row) => ({
          category: row.category,
          critical: Number(row.critical),
          nonCritical: Number(row.non_critical)
        }))
      },
      topThirdParties: topThirdPartiesResult.rows.map((row) => ({
        name: row.name,
        applications: Number(row.applications),
        services: Number(row.services)
      })),
      topCriticalServices: topCriticalServicesResult.rows.map((row) => ({
        name: row.name,
        channels: Number(row.channels),
        applications: Number(row.applications),
        integrations: Number(row.integrations)
      })),
      serviceRiskMap: serviceRiskMapResult.rows.map((row) => ({
        name: row.name,
        channels: Number(row.channels),
        applications: Number(row.applications),
        integrations: Number(row.integrations),
        isCritical: row.is_critical
      })),
      functionPortfolio: functionPortfolioResult.rows.map((row) => ({
        name: row.name,
        services: Number(row.services),
        criticalServices: Number(row.critical_services),
        applications: Number(row.applications),
        integrations: Number(row.integrations),
        thirdParties: Number(row.third_parties)
      })),
      channelPortfolio: channelPortfolioResult.rows.map((row) => ({
        name: row.name,
        services: Number(row.services),
        applications: Number(row.applications),
        integrations: Number(row.integrations),
        paths: Number(row.paths)
      })),
      applicationComplexity: applicationComplexityResult.rows.map((row) => ({
        bucket: row.bucket,
        applications: Number(row.applications)
      })),
      thirdPartyByFunction: thirdPartyByFunctionResult.rows.map((row) => ({
        name: row.name,
        thirdParties: Number(row.third_parties),
        applications: Number(row.applications)
      }))
    };
  }

  async getExecutiveDashboard(datasetId = DEFAULT_DATASET_ID): Promise<ExecutiveDashboardResponse> {
    void datasetId;
    const summaryResult = await this.postgres.query<{
      total_services: string;
      total_functions: string;
      total_applications: string;
      total_integrations: string;
      total_third_parties: string;
      critical_services: string;
      third_party_dependent_services: string;
      critical_hardware_exposed_services: string;
      both_third_party_and_critical_hardware_services: string;
      avg_applications_per_service: string;
      avg_integrations_per_service: string;
    }>(
      `
      WITH service_flags AS (
        SELECT service_id, bool_or(is_critical) AS is_critical
        FROM fact_service_dependency
        GROUP BY service_id
      ),
      services_with_third_party AS (
        SELECT DISTINCT service_id
        FROM fact_application_third_party
      ),
      critical_hardware_services AS (
        SELECT DISTINCT f.service_id
        FROM fact_service_dependency f
        WHERE EXISTS (
          SELECT 1
          FROM fact_integration_hardware_spec hw
          WHERE hw.is_critical
            AND (hw.application_id = f.application_id OR hw.integration_id = f.integration_id)
        )
      ),
      service_breadth AS (
        SELECT
          service_id,
          count(DISTINCT application_id)::numeric AS applications,
          count(DISTINCT integration_id)::numeric AS integrations
        FROM fact_service_dependency
        GROUP BY service_id
      )
      SELECT
        (SELECT count(DISTINCT service_id) FROM fact_service_dependency)::text AS total_services,
        (SELECT count(DISTINCT function_id) FROM fact_service_dependency WHERE function_id IS NOT NULL)::text AS total_functions,
        (SELECT count(DISTINCT application_id) FROM fact_service_dependency)::text AS total_applications,
        (SELECT count(DISTINCT integration_id) FROM fact_service_dependency)::text AS total_integrations,
        (SELECT count(DISTINCT third_party_id) FROM fact_application_third_party)::text AS total_third_parties,
        (SELECT count(*) FROM service_flags WHERE is_critical)::text AS critical_services,
        (SELECT count(*) FROM services_with_third_party)::text AS third_party_dependent_services,
        (SELECT count(*) FROM critical_hardware_services)::text AS critical_hardware_exposed_services,
        (
          SELECT count(*)
          FROM services_with_third_party tp
          JOIN critical_hardware_services hw ON hw.service_id = tp.service_id
        )::text AS both_third_party_and_critical_hardware_services,
        COALESCE((SELECT avg(applications) FROM service_breadth), 0)::text AS avg_applications_per_service,
        COALESCE((SELECT avg(integrations) FROM service_breadth), 0)::text AS avg_integrations_per_service
      `
    );

    const functionResult = await this.postgres.query<{
      name: string;
      services: string;
      critical_services: string;
      portfolio_percentage: string;
      criticality_rate: string;
    }>(
      `
      WITH service_flags AS (
        SELECT service_id, bool_or(is_critical) AS is_critical
        FROM fact_service_dependency
        GROUP BY service_id
      ),
      total_services AS (
        SELECT count(DISTINCT service_id)::numeric AS total
        FROM fact_service_dependency
      )
      SELECT
        COALESCE(fn.function_name, 'Unassigned') AS name,
        count(DISTINCT f.service_id)::text AS services,
        count(DISTINCT f.service_id) FILTER (WHERE sf.is_critical)::text AS critical_services,
        round((count(DISTINCT f.service_id)::numeric / NULLIF((SELECT total FROM total_services), 0)) * 100, 1)::text AS portfolio_percentage,
        round((count(DISTINCT f.service_id) FILTER (WHERE sf.is_critical)::numeric / NULLIF(count(DISTINCT f.service_id), 0)) * 100, 1)::text AS criticality_rate
      FROM fact_service_dependency f
      LEFT JOIN dim_function fn ON fn.function_id = f.function_id
      JOIN service_flags sf ON sf.service_id = f.service_id
      GROUP BY COALESCE(fn.function_name, 'Unassigned')
      ORDER BY count(DISTINCT f.service_id) DESC, COALESCE(fn.function_name, 'Unassigned')
      `
    );

    const thirdPartyResult = await this.postgres.query<{
      name: string;
      services: string;
      critical_services: string;
      applications: string;
      functions: string;
      service_exposure_percentage: string;
      criticality_rate: string;
    }>(
      `
      WITH service_flags AS (
        SELECT service_id, bool_or(is_critical) AS is_critical
        FROM fact_service_dependency
        GROUP BY service_id
      ),
      total_services AS (
        SELECT count(DISTINCT service_id)::numeric AS total
        FROM fact_service_dependency
      )
      SELECT
        tp.third_party_name AS name,
        count(DISTINCT atp.service_id)::text AS services,
        count(DISTINCT atp.service_id) FILTER (WHERE sf.is_critical)::text AS critical_services,
        count(DISTINCT atp.application_id)::text AS applications,
        count(DISTINCT COALESCE(atp.function_id, 0))::text AS functions,
        round((count(DISTINCT atp.service_id)::numeric / NULLIF((SELECT total FROM total_services), 0)) * 100, 1)::text AS service_exposure_percentage,
        round((count(DISTINCT atp.service_id) FILTER (WHERE sf.is_critical)::numeric / NULLIF(count(DISTINCT atp.service_id), 0)) * 100, 1)::text AS criticality_rate
      FROM fact_application_third_party atp
      JOIN dim_third_party tp ON tp.third_party_id = atp.third_party_id
      JOIN service_flags sf ON sf.service_id = atp.service_id
      GROUP BY tp.third_party_id, tp.third_party_name
      ORDER BY count(DISTINCT atp.service_id) DESC, count(DISTINCT atp.service_id) FILTER (WHERE sf.is_critical) DESC, tp.third_party_name
      LIMIT 15
      `
    );

    const applicationResult = await this.postgres.query<{
      name: string;
      services: string;
      critical_services: string;
      functions: string;
      direct_channels: string;
      integrations: string;
      third_parties: string;
      hardware_specs: string;
    }>(
      `
      WITH service_flags AS (
        SELECT service_id, bool_or(is_critical) AS is_critical
        FROM fact_service_dependency
        GROUP BY service_id
      ),
      third_party_by_app AS (
        SELECT application_id, count(DISTINCT third_party_id) AS third_parties
        FROM fact_application_third_party
        GROUP BY application_id
      ),
      hardware_by_app AS (
        SELECT
          f.application_id,
          count(DISTINCT hw.hardware_spec_id) AS hardware_specs
        FROM fact_service_dependency f
        JOIN fact_integration_hardware_spec hw
          ON hw.application_id = f.application_id OR hw.integration_id = f.integration_id
        GROUP BY f.application_id
      )
      SELECT
        app.application_name AS name,
        count(DISTINCT f.service_id)::text AS services,
        count(DISTINCT f.service_id) FILTER (WHERE sf.is_critical)::text AS critical_services,
        count(DISTINCT COALESCE(f.function_id, 0))::text AS functions,
        count(DISTINCT f.direct_channel_id)::text AS direct_channels,
        count(DISTINCT f.integration_id)::text AS integrations,
        COALESCE(max(tp.third_parties), 0)::text AS third_parties,
        COALESCE(max(hw.hardware_specs), 0)::text AS hardware_specs
      FROM fact_service_dependency f
      JOIN dim_application app ON app.application_id = f.application_id
      JOIN service_flags sf ON sf.service_id = f.service_id
      LEFT JOIN third_party_by_app tp ON tp.application_id = f.application_id
      LEFT JOIN hardware_by_app hw ON hw.application_id = f.application_id
      GROUP BY app.application_id, app.application_name
      ORDER BY count(DISTINCT f.service_id) DESC, count(DISTINCT f.service_id) FILTER (WHERE sf.is_critical) DESC, app.application_name
      LIMIT 10
      `
    );

    const integrationResult = await this.postgres.query<{
      name: string;
      services: string;
      critical_services: string;
      applications: string;
      functions: string;
      channels: string;
      critical_hardware_specs: string;
      hardware_specs: string;
    }>(
      `
      WITH service_flags AS (
        SELECT service_id, bool_or(is_critical) AS is_critical
        FROM fact_service_dependency
        GROUP BY service_id
      ),
      hardware_by_integration AS (
        SELECT
          integration_id,
          count(DISTINCT hardware_spec_id) AS hardware_specs,
          count(DISTINCT hardware_spec_id) FILTER (WHERE is_critical) AS critical_hardware_specs
        FROM fact_integration_hardware_spec
        WHERE integration_id IS NOT NULL
        GROUP BY integration_id
      )
      SELECT
        integ.integration_name AS name,
        count(DISTINCT f.service_id)::text AS services,
        count(DISTINCT f.service_id) FILTER (WHERE sf.is_critical)::text AS critical_services,
        count(DISTINCT f.application_id)::text AS applications,
        count(DISTINCT COALESCE(f.function_id, 0))::text AS functions,
        count(DISTINCT f.direct_channel_id)::text AS channels,
        COALESCE(max(hw.critical_hardware_specs), 0)::text AS critical_hardware_specs,
        COALESCE(max(hw.hardware_specs), 0)::text AS hardware_specs
      FROM fact_service_dependency f
      JOIN dim_integration integ ON integ.integration_id = f.integration_id
      JOIN service_flags sf ON sf.service_id = f.service_id
      LEFT JOIN hardware_by_integration hw ON hw.integration_id = f.integration_id
      GROUP BY integ.integration_id, integ.integration_name
      ORDER BY count(DISTINCT f.service_id) DESC, count(DISTINCT f.service_id) FILTER (WHERE sf.is_critical) DESC, integ.integration_name
      LIMIT 10
      `
    );

    const complexityResult = await this.postgres.query<{
      name: string;
      average_applications_per_service: string;
      average_integrations_per_service: string;
      average_third_parties_per_service: string;
      average_dependency_paths_per_service: string;
    }>(
      `
      WITH function_services AS (
        SELECT
          COALESCE(fn.function_name, 'Unassigned') AS name,
          f.service_id,
          count(DISTINCT f.application_id)::numeric AS applications,
          count(DISTINCT f.integration_id)::numeric AS integrations,
          count(*)::numeric AS dependency_paths
        FROM fact_service_dependency f
        LEFT JOIN dim_function fn ON fn.function_id = f.function_id
        GROUP BY COALESCE(fn.function_name, 'Unassigned'), f.service_id
      ),
      third_parties AS (
        SELECT
          COALESCE(fn.function_name, 'Unassigned') AS name,
          atp.service_id,
          count(DISTINCT atp.third_party_id)::numeric AS third_parties
        FROM fact_application_third_party atp
        LEFT JOIN dim_function fn ON fn.function_id = atp.function_id
        GROUP BY COALESCE(fn.function_name, 'Unassigned'), atp.service_id
      )
      SELECT
        fs.name,
        round(avg(fs.applications), 1)::text AS average_applications_per_service,
        round(avg(fs.integrations), 1)::text AS average_integrations_per_service,
        round(avg(COALESCE(tp.third_parties, 0)), 1)::text AS average_third_parties_per_service,
        round(avg(fs.dependency_paths), 1)::text AS average_dependency_paths_per_service
      FROM function_services fs
      LEFT JOIN third_parties tp ON tp.name = fs.name AND tp.service_id = fs.service_id
      GROUP BY fs.name
      ORDER BY avg(fs.applications + fs.integrations + COALESCE(tp.third_parties, 0) + fs.dependency_paths) DESC, fs.name
      `
    );

    const summaryRow = summaryResult.rows[0] ?? {
      total_services: "0",
      total_functions: "0",
      total_applications: "0",
      total_integrations: "0",
      total_third_parties: "0",
      critical_services: "0",
      third_party_dependent_services: "0",
      critical_hardware_exposed_services: "0",
      both_third_party_and_critical_hardware_services: "0",
      avg_applications_per_service: "0",
      avg_integrations_per_service: "0"
    };
    const totalServices = Number(summaryRow.total_services);
    const criticalServices = Number(summaryRow.critical_services);
    const thirdPartyDependentServices = Number(summaryRow.third_party_dependent_services);
    const criticalHardwareExposedServices = Number(summaryRow.critical_hardware_exposed_services);
    const bothThirdPartyAndCriticalHardware = Number(summaryRow.both_third_party_and_critical_hardware_services);
    const servicesByFunction = functionResult.rows.map((row) => ({
      name: row.name,
      services: Number(row.services),
      criticalServices: Number(row.critical_services),
      portfolioPercentage: Number(row.portfolio_percentage ?? 0),
      criticalityRate: Number(row.criticality_rate ?? 0)
    }));
    const { rows: thirdPartyRisk, thresholds } = classifyThirdParties(
      thirdPartyResult.rows.map((row) => ({
        name: row.name,
        services: Number(row.services),
        criticalServices: Number(row.critical_services),
        applications: Number(row.applications),
        functions: Number(row.functions),
        serviceExposurePercentage: Number(row.service_exposure_percentage ?? 0),
        criticalityRate: Number(row.criticality_rate ?? 0)
      })),
      totalServices
    );
    const topApplications = classifyApplications(
      applicationResult.rows.map((row) => ({
        name: row.name,
        services: Number(row.services),
        criticalServices: Number(row.critical_services),
        functions: Number(row.functions),
        directChannels: Number(row.direct_channels),
        integrations: Number(row.integrations),
        thirdParties: Number(row.third_parties),
        hardwareSpecs: Number(row.hardware_specs)
      })),
      totalServices
    );
    const topIntegrations = integrationResult.rows.map((row) => ({
      name: row.name,
      services: Number(row.services),
      criticalServices: Number(row.critical_services),
      applications: Number(row.applications),
      functions: Number(row.functions),
      channels: Number(row.channels),
      criticalHardwareSpecs: Number(row.critical_hardware_specs),
      hardwareSpecs: Number(row.hardware_specs)
    }));
    const complexityByFunction = complexityResult.rows.map((row) => ({
      name: row.name,
      averageApplicationsPerService: Number(row.average_applications_per_service),
      averageIntegrationsPerService: Number(row.average_integrations_per_service),
      averageThirdPartiesPerService: Number(row.average_third_parties_per_service),
      averageDependencyPathsPerService: Number(row.average_dependency_paths_per_service)
    }));
    const exposureSummary = [
      {
        category: "Critical service",
        services: criticalServices,
        percentage: percentage(criticalServices, totalServices),
        calculation: "Distinct services with any critical service path."
      },
      {
        category: "Third-party dependent",
        services: thirdPartyDependentServices,
        percentage: percentage(thirdPartyDependentServices, totalServices),
        calculation: "Distinct services appearing in third-party relationships."
      },
      {
        category: "Critical-hardware exposed",
        services: criticalHardwareExposedServices,
        percentage: percentage(criticalHardwareExposedServices, totalServices),
        calculation: "Distinct services linked through application or integration to critical hardware."
      },
      {
        category: "Third-party and critical-hardware exposed",
        services: bothThirdPartyAndCriticalHardware,
        percentage: percentage(bothThirdPartyAndCriticalHardware, totalServices),
        calculation: "Distinct services present in both exposure groups; categories overlap and should not be summed."
      }
    ];

    return {
      summary: buildSummary({
        totalServices,
        totalFunctions: Number(summaryRow.total_functions),
        totalApplications: Number(summaryRow.total_applications),
        totalIntegrations: Number(summaryRow.total_integrations),
        totalThirdParties: Number(summaryRow.total_third_parties),
        criticalServices,
        thirdPartyDependentServices,
        criticalHardwareExposedServices,
        averageApplicationsPerService: Number(summaryRow.avg_applications_per_service),
        averageIntegrationsPerService: Number(summaryRow.avg_integrations_per_service)
      }),
      servicesByFunction,
      functionCriticality: [...servicesByFunction].sort((left, right) => right.criticalityRate - left.criticalityRate || right.services - left.services),
      topThirdParties: thirdPartyRisk.slice(0, 10),
      thirdPartyRisk,
      topApplications,
      topIntegrations,
      complexityByFunction,
      exposureSummary,
      insights: buildExecutiveInsights({
        totalServices,
        criticalServices,
        servicesByFunction,
        topThirdParties: thirdPartyRisk.slice(0, 10),
        topApplications,
        topIntegrations,
        complexityByFunction,
        exposureSummary
      }),
      thresholds,
      generatedAt: new Date().toISOString()
    };
  }

  async search(query: string, datasetId = DEFAULT_DATASET_ID, limit = 20): Promise<SearchResultItem[]> {
    void datasetId;
    const normalizedQuery = normalizeName(query);
    const result = await this.postgres.query<DimensionRow>(
      `
      SELECT * FROM (
        SELECT
          s.service_id::text AS id,
          'Service:' || s.service_id::text AS context_key,
          s.service_name AS context_label,
          s.service_name,
          s.service_name AS name,
          s.normalized_name,
          'Service' AS type
        FROM dim_service s
        WHERE $1 = '' OR s.normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT DISTINCT
          dc.direct_channel_id::text,
          'DirectChannel:' || dc.direct_channel_id::text || ':Service:' || s.service_id::text,
          s.service_name || ' / ' || dc.direct_channel_name,
          s.service_name,
          dc.direct_channel_name,
          dc.normalized_name,
          'DirectChannel'
        FROM fact_service_dependency f
        JOIN dim_service s ON s.service_id = f.service_id
        JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
        WHERE $1 = '' OR dc.normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT DISTINCT
          app.application_id::text,
          'Application:' || app.application_id::text || ':Service:' || s.service_id::text || ':DirectChannel:' || dc.direct_channel_id::text,
          s.service_name || ' / ' || dc.direct_channel_name || ' / ' || app.application_name,
          s.service_name,
          app.application_name,
          app.normalized_name,
          'Application'
        FROM fact_service_dependency f
        JOIN dim_service s ON s.service_id = f.service_id
        JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
        JOIN dim_application app ON app.application_id = f.application_id
        WHERE $1 = '' OR app.normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT DISTINCT
          integ.integration_id::text,
          'Integration:' || integ.integration_id::text || ':Service:' || s.service_id::text || ':DirectChannel:' || dc.direct_channel_id::text || ':Application:' || app.application_id::text,
          s.service_name || ' / ' || dc.direct_channel_name || ' / ' || app.application_name || ' / ' || integ.integration_name,
          s.service_name,
          integ.integration_name,
          integ.normalized_name,
          'Integration'
        FROM fact_service_dependency f
        JOIN dim_service s ON s.service_id = f.service_id
        JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
        JOIN dim_application app ON app.application_id = f.application_id
        JOIN dim_integration integ ON integ.integration_id = f.integration_id
        WHERE $1 = '' OR integ.normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT DISTINCT
          tp.third_party_id::text,
          'ThirdParty:' || tp.third_party_id::text || ':Service:' || s.service_id::text || ':DirectChannel:' || dc.direct_channel_id::text || ':Application:' || app.application_id::text,
          s.service_name || ' / ' || dc.direct_channel_name || ' / ' || app.application_name || ' / ' || tp.third_party_name,
          s.service_name,
          tp.third_party_name,
          tp.normalized_name,
          'ThirdParty'
        FROM fact_application_third_party f
        JOIN dim_service s ON s.service_id = f.service_id
        JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
        JOIN dim_application app ON app.application_id = f.application_id
        JOIN dim_third_party tp ON tp.third_party_id = f.third_party_id
        WHERE $1 = '' OR tp.normalized_name LIKE '%' || $1 || '%'
        UNION ALL
        SELECT DISTINCT
          hw.hardware_spec_id::text,
          'HardwareSpec:' || hw.hardware_spec_id::text,
          hw.spec_category || ' / ' || hw.spec_name,
          NULL::text,
          hw.spec_name,
          hw.normalized_name,
          'HardwareSpec'
        FROM dim_hardware_spec hw
        WHERE $1 = '' OR hw.normalized_name LIKE '%' || $1 || '%'
      ) AS results
      ORDER BY type, context_label, name
      LIMIT $2
      `,
      [normalizedQuery, limit]
    );

    return result.rows.map(toSearchResult);
  }

  async listByType(type: string, datasetId = DEFAULT_DATASET_ID, limit = 1000): Promise<SearchResultItem[]> {
    void datasetId;
    const table = tableForType(type);
    const idColumn = idColumnForType(type);
    const nameColumn = nameColumnForType(type);
    const result = await this.postgres.query<DimensionRow>(
      `
      SELECT ${idColumn}::text AS id, ${nameColumn} AS name, normalized_name, $1::text AS type
      FROM ${table}
      ORDER BY ${nameColumn}
      LIMIT $2
      `,
      [type, limit]
    );

    return result.rows.map(toSearchResult);
  }

  async listServicesByFunction(functionId: number, datasetId = DEFAULT_DATASET_ID, limit = 1000): Promise<SearchResultItem[]> {
    void datasetId;
    const result = await this.postgres.query<DimensionRow>(
      `
      SELECT DISTINCT
        s.service_id::text AS id,
        s.service_name AS name,
        s.normalized_name,
        $2::text AS type
      FROM fact_service_dependency f
      JOIN dim_service s ON s.service_id = f.service_id
      WHERE f.function_id = $1
      ORDER BY s.service_name
      LIMIT $3
      `,
      [functionId, CANONICAL_NODE_TYPES.SERVICE, limit]
    );

    return result.rows.map(toSearchResult);
  }

  async getServiceDependencies(name: string, datasetId = DEFAULT_DATASET_ID): Promise<GraphResponse> {
    void datasetId;
    const rows = await this.getDependencyRows(normalizeName(name));
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
    void datasetId;
    const rows = await this.getImpactRows(type, normalizeName(name));
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
      SELECT ${idColumn}::text AS id, ${nameColumn} AS name, normalized_name, $1::text AS type
      FROM ${table}
      WHERE ${idColumn} = $2
      `,
      [type, Number(id)]
    );
    const row = result.rows[0];
    return row ? dimensionRowToGraphNode(row) : null;
  }

  private async insertFact(client: PoolClient, fact: ImportFactInput): Promise<void> {
    const functionId = fact.functionName ? await upsertDimension(client, "dim_function", "function", fact.functionName) : null;
    const serviceId = await upsertDimension(client, "dim_service", "service", fact.serviceName);
    const directChannelId = await upsertDimension(client, "dim_direct_channel", "direct_channel", fact.directChannelName);
    const applicationId = await upsertDimension(client, "dim_application", "application", fact.applicationName);
    const integrationId = await upsertDimension(client, "dim_integration", "integration", fact.integrationName);

    await client.query(
      `
      INSERT INTO fact_service_dependency (
        function_id,
        service_id,
        is_critical,
        direct_channel_id,
        application_id,
        integration_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (
        service_id,
        direct_channel_id,
        application_id,
        integration_id
      )
      DO UPDATE SET
        function_id = EXCLUDED.function_id,
        is_critical = EXCLUDED.is_critical
      `,
      [
        functionId,
        serviceId,
        fact.serviceIsCritical,
        directChannelId,
        applicationId,
        integrationId
      ]
    );
  }

  private async clearImportedData(client: PoolClient): Promise<void> {
    await client.query(`
      TRUNCATE TABLE
        fact_application_third_party,
        fact_integration_hardware_spec,
        fact_service_dependency,
        dim_function,
        dim_service,
        dim_direct_channel,
        dim_application,
        dim_integration,
        dim_hardware_spec,
        dim_third_party
      RESTART IDENTITY CASCADE
    `);
  }

  private async insertHardwareSpecFact(
    client: PoolClient,
    hardwareSpec: ImportHardwareSpecInput
  ): Promise<void> {
    const applicationId =
      hardwareSpec.sourceType === CANONICAL_NODE_TYPES.APPLICATION
        ? await upsertDimension(client, "dim_application", "application", hardwareSpec.sourceName)
        : null;
    const integrationId =
      hardwareSpec.sourceType === CANONICAL_NODE_TYPES.INTEGRATION
        ? await upsertDimension(client, "dim_integration", "integration", hardwareSpec.sourceName)
        : null;
    const hardwareSpecId = await upsertHardwareSpecDimension(client, hardwareSpec.specName, hardwareSpec.specCategory);

    await client.query(
      `
      INSERT INTO fact_integration_hardware_spec (
        application_id,
        integration_id,
        hardware_spec_id,
        is_critical
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (
        application_id,
        integration_id,
        hardware_spec_id
      )
      DO UPDATE SET
        is_critical = EXCLUDED.is_critical
      `,
      [
        applicationId,
        integrationId,
        hardwareSpecId,
        hardwareSpec.isCritical
      ]
    );
  }

  private async insertThirdPartyFact(
    client: PoolClient,
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
        function_id,
        service_id,
        direct_channel_id,
        application_id,
        third_party_id
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (
        service_id,
        direct_channel_id,
        application_id,
        third_party_id
      )
      DO UPDATE SET
        function_id = EXCLUDED.function_id
      `,
      [
        functionId,
        serviceId,
        directChannelId,
        applicationId,
        thirdPartyId
      ]
    );
  }

  private async getDependencyRows(serviceName: string): Promise<DependencyRow[]> {
    const result = await this.postgres.query<DependencyRow>(
      `
      SELECT
        s.service_id::text,
        s.service_name,
        s.normalized_name AS service_normalized_name,
        bool_or(f.is_critical) OVER (PARTITION BY s.service_id) AS service_is_critical,
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
        CASE WHEN ihs.application_id IS NOT NULL THEN 'Application' WHEN ihs.integration_id IS NOT NULL THEN 'Integration' ELSE NULL END AS hardware_source_type
      FROM fact_service_dependency f
      JOIN dim_service s ON s.service_id = f.service_id
      JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
      JOIN dim_application app ON app.application_id = f.application_id
      JOIN dim_integration integ ON integ.integration_id = f.integration_id
      LEFT JOIN fact_application_third_party atp
        ON atp.service_id = f.service_id
       AND atp.direct_channel_id = f.direct_channel_id
       AND atp.application_id = f.application_id
      LEFT JOIN dim_third_party tp ON tp.third_party_id = atp.third_party_id
      LEFT JOIN fact_integration_hardware_spec ihs
        ON (
        ihs.integration_id = f.integration_id
        OR ihs.application_id = f.application_id
       )
      LEFT JOIN dim_hardware_spec hw ON hw.hardware_spec_id = ihs.hardware_spec_id
      WHERE s.normalized_name = $1
      ORDER BY dc.direct_channel_name, app.application_name, integ.integration_name, tp.third_party_name, hw.spec_category, hw.spec_name
      `,
      [serviceName]
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
        bool_or(f.is_critical) OVER (PARTITION BY s.service_id) AS service_is_critical,
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
        NULL::text AS hardware_source_type
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

  private async getImpactRows(type: string, normalizedName: string): Promise<DependencyRow[]> {
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
        bool_or(f.is_critical) OVER (PARTITION BY s.service_id) AS service_is_critical,
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
        CASE WHEN ihs.application_id IS NOT NULL THEN 'Application' WHEN ihs.integration_id IS NOT NULL THEN 'Integration' ELSE NULL END AS hardware_source_type
      FROM fact_service_dependency f
      JOIN ${table} selected ON selected.${idColumn} = f.${factColumn}
      JOIN dim_service s ON s.service_id = f.service_id
      JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
      JOIN dim_application app ON app.application_id = f.application_id
      JOIN dim_integration integ ON integ.integration_id = f.integration_id
      LEFT JOIN fact_application_third_party atp
        ON atp.service_id = f.service_id
       AND atp.direct_channel_id = f.direct_channel_id
       AND atp.application_id = f.application_id
      LEFT JOIN dim_third_party tp ON tp.third_party_id = atp.third_party_id
      LEFT JOIN fact_integration_hardware_spec ihs
        ON (
        ihs.integration_id = f.integration_id
        OR ihs.application_id = f.application_id
       )
      LEFT JOIN dim_hardware_spec hw ON hw.hardware_spec_id = ihs.hardware_spec_id
      WHERE selected.normalized_name = $1
      ORDER BY s.service_name, dc.direct_channel_name, app.application_name, integ.integration_name, tp.third_party_name, hw.spec_category, hw.spec_name
      `,
      [normalizedName]
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
        datasetId: DEFAULT_DATASET_ID,
        properties: nodeProperties.get(rootId)
      }
    ]
  ]);
  const edges = new Map<string, GraphEdge>();

  for (const row of rows) {
    const directChannelId = `${rootId}/DirectChannel:${row.direct_channel_id}`;
    const applicationId = `${directChannelId}/Application:${row.application_id}`;
    const integrationId = `${directChannelId}/Integration:${row.integration_id}`;

    nodes.set(directChannelId, toVirtualNode(directChannelId, `DirectChannel:${row.direct_channel_id}`, CANONICAL_NODE_TYPES.DIRECT_CHANNEL, row.direct_channel_name, row.direct_channel_normalized_name, DEFAULT_DATASET_ID, nodeProperties.get(directChannelId)));
    nodes.set(applicationId, toVirtualNode(applicationId, `Application:${row.application_id}`, CANONICAL_NODE_TYPES.APPLICATION, row.application_name, row.application_normalized_name, DEFAULT_DATASET_ID, nodeProperties.get(applicationId)));
    nodes.set(integrationId, toVirtualNode(integrationId, `Integration:${row.integration_id}`, CANONICAL_NODE_TYPES.INTEGRATION, row.integration_name, row.integration_normalized_name, DEFAULT_DATASET_ID, nodeProperties.get(integrationId)));

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
            DEFAULT_DATASET_ID
          )
        : toVirtualNode(
            rootId,
            rootId,
            CANONICAL_NODE_TYPES.APPLICATION,
            selected.application_name,
            selected.application_normalized_name,
            DEFAULT_DATASET_ID
          )
    ]
  ]);
  const edges = new Map<string, GraphEdge>();

  for (const row of rows) {
    const serviceId = `Service:${row.service_id}`;
    const directChannelId = `DirectChannel:${row.direct_channel_id}`;
    const applicationId = `Application:${row.application_id}`;
    const integrationId = `Integration:${row.integration_id}`;

    nodes.set(serviceId, toVirtualNode(serviceId, serviceId, CANONICAL_NODE_TYPES.SERVICE, row.service_name, row.service_normalized_name, DEFAULT_DATASET_ID));
    nodes.set(directChannelId, toVirtualNode(directChannelId, directChannelId, CANONICAL_NODE_TYPES.DIRECT_CHANNEL, row.direct_channel_name, row.direct_channel_normalized_name, DEFAULT_DATASET_ID));
    if (type === CANONICAL_NODE_TYPES.INTEGRATION) {
      nodes.set(applicationId, toVirtualNode(applicationId, applicationId, CANONICAL_NODE_TYPES.APPLICATION, row.application_name, row.application_normalized_name, DEFAULT_DATASET_ID));
      addEdge(edges, rootId, applicationId, "IMPACTS");
      addEdge(edges, applicationId, directChannelId, "IMPACTS");
    } else {
      nodes.set(integrationId, toVirtualNode(integrationId, integrationId, CANONICAL_NODE_TYPES.INTEGRATION, row.integration_name, row.integration_normalized_name, DEFAULT_DATASET_ID));
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
    if (row.third_party_name) {
      addPropertyValue(properties, rootId, "thirdParties", row.third_party_name);
    }

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
      const hardwareNodeId = row.hardware_source_type === CANONICAL_NODE_TYPES.APPLICATION ? applicationId : integrationId;
      addPropertyValue(properties, hardwareNodeId, "hardwareSpecs", formatHardwareSpec(row));
    }
    if (row.hardware_spec_is_critical && row.hardware_spec_name) {
      const hardwareNodeId = row.hardware_source_type === CANONICAL_NODE_TYPES.APPLICATION ? applicationId : integrationId;
      addPropertyValue(properties, hardwareNodeId, "criticalHardwareSpecs", formatHardwareSpec(row));
    }
  }

  properties.set(rootId, {
    ...(properties.get(rootId) ?? {}),
    isCritical: rows.some((row) => row.service_is_critical),
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
    contextKey: row.context_key ?? undefined,
    contextLabel: row.context_label ?? undefined,
    serviceName: row.service_name ?? undefined,
    name: row.name,
    normalizedName: row.normalized_name,
    type: row.type,
    datasetId: DEFAULT_DATASET_ID
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
    datasetId: DEFAULT_DATASET_ID
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
