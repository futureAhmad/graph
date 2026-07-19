import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { normalizeName } from "../../common/utils/text-normalizer";
import { PostgresService } from "../postgres/postgres.service";
import { CreateServicePathDto } from "./dto/admin-service.dto";

@Injectable()
export class AdminService {
  constructor(private readonly postgres: PostgresService) {}

  async getOptions() {
    const [services, directChannels, applications, integrations, hardwareSpecs, thirdParties] = await Promise.all([
      this.listDimension("dim_service", "service_id", "service_name"),
      this.listDimension("dim_direct_channel", "direct_channel_id", "direct_channel_name"),
      this.listDimension("dim_application", "application_id", "application_name"),
      this.listDimension("dim_integration", "integration_id", "integration_name"),
      this.listHardwareSpecs(),
      this.listDimension("dim_third_party", "third_party_id", "third_party_name")
    ]);

    return { services, directChannels, applications, integrations, hardwareSpecs, thirdParties };
  }

  async createServicePath(dto: CreateServicePathDto) {
    return this.postgres.transaction(async (client) => {
      const functionId = dto.functionName?.trim()
        ? await upsertDimension(client, "dim_function", "function", dto.functionName)
        : null;
      const serviceId = await upsertDimension(client, "dim_service", "service", dto.service.name);
      const directChannelId = await upsertDimension(client, "dim_direct_channel", "direct_channel", dto.directChannel.name);
      const applicationId = await upsertDimension(client, "dim_application", "application", dto.application.name);
      const integrationId = await upsertDimension(client, "dim_integration", "integration", dto.integration.name);

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
        RETURNING service_dependency_id
        `,
        [functionId, serviceId, dto.serviceIsCritical, directChannelId, applicationId, integrationId]
      );

      if (dto.hardwareSpec?.name.trim()) {
        const hardwareSpecId = await upsertHardwareSpec(client, dto.hardwareSpec.name, dto.hardwareSpec.category);
        const sourceApplicationId = dto.hardwareSpec.sourceType === "application" ? applicationId : null;
        const sourceIntegrationId = dto.hardwareSpec.sourceType === "integration" ? integrationId : null;
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
          DO UPDATE SET is_critical = EXCLUDED.is_critical
          `,
          [sourceApplicationId, sourceIntegrationId, hardwareSpecId, dto.hardwareSpec.isCritical]
        );
      }

      if (dto.thirdPartyName?.trim()) {
        const thirdPartyId = await upsertDimension(client, "dim_third_party", "third_party", dto.thirdPartyName);
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
          DO UPDATE SET function_id = EXCLUDED.function_id
          `,
          [functionId, serviceId, directChannelId, applicationId, thirdPartyId]
        );
      }

      return { created: true };
    });
  }

  private async listDimension(table: string, idColumn: string, nameColumn: string) {
    const result = await this.postgres.query<{ id: string; name: string }>(
      `
      SELECT ${idColumn}::text AS id, ${nameColumn} AS name
      FROM ${table}
      ORDER BY ${nameColumn}
      `
    );
    return result.rows;
  }

  private async listHardwareSpecs() {
    const result = await this.postgres.query<{ id: string; name: string; category: string }>(
      `
      SELECT hardware_spec_id::text AS id, spec_name AS name, spec_category AS category
      FROM dim_hardware_spec
      ORDER BY spec_category, spec_name
      `
    );
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
    DO UPDATE SET ${nameColumn} = EXCLUDED.${nameColumn}, updated_at = now()
    RETURNING ${idColumn} AS id
    `,
    [name.trim(), normalizeName(name)]
  );
  return result.rows[0].id;
}

async function upsertHardwareSpec(client: PoolClient, name: string, category: string): Promise<number> {
  const result = await client.query<{ id: number }>(
    `
    INSERT INTO dim_hardware_spec (spec_name, spec_category, normalized_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (normalized_name)
    DO UPDATE SET spec_name = EXCLUDED.spec_name, spec_category = EXCLUDED.spec_category, updated_at = now()
    RETURNING hardware_spec_id AS id
    `,
    [name.trim(), category.trim(), normalizeName(name)]
  );
  return result.rows[0].id;
}
