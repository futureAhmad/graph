import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

const DEFAULT_DATABASE_URL = "postgresql://service_dependency:password@127.0.0.1:55432/service_dependency";

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const configuredDatabaseUrl = configService.get<string>("DATABASE_URL");

    this.pool = new Pool({
      connectionString: isPlaceholderDatabaseUrl(configuredDatabaseUrl) ? DEFAULT_DATABASE_URL : configuredDatabaseUrl
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

function isPlaceholderDatabaseUrl(value: string | undefined): value is undefined {
  return !value || ["base", "f"].includes(value.trim().toLowerCase());
}
