# Database Schema Setup

Use this file when setting up the app on another laptop. The authoritative SQL file is:

```text
infra/sql/init/001_service_dependency_schema.sql
```

Apply it to a running PostgreSQL database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/sql/init/001_service_dependency_schema.sql
```

For the Docker database in this repo:

```bash
docker compose -f infra/docker-compose.yml exec -T postgres psql -U service_dependency -d service_dependency -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/001_service_dependency_schema.sql
```

## Tables

```sql
CREATE TABLE IF NOT EXISTS app_user (
  user_id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_app_user_username UNIQUE (username),
  CONSTRAINT ck_app_user_role CHECK (role IN ('admin', 'user'))
);

CREATE TABLE IF NOT EXISTS dim_function (
  function_id BIGSERIAL PRIMARY KEY,
  function_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dim_function_name UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS dim_service (
  service_id BIGSERIAL PRIMARY KEY,
  service_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dim_service_name UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS dim_direct_channel (
  direct_channel_id BIGSERIAL PRIMARY KEY,
  direct_channel_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dim_direct_channel_name UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS dim_application (
  application_id BIGSERIAL PRIMARY KEY,
  application_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dim_application_name UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS dim_integration (
  integration_id BIGSERIAL PRIMARY KEY,
  integration_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dim_integration_name UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS dim_hardware_spec (
  hardware_spec_id BIGSERIAL PRIMARY KEY,
  spec_name TEXT NOT NULL,
  spec_category TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dim_hardware_spec_name UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS dim_third_party (
  third_party_id BIGSERIAL PRIMARY KEY,
  third_party_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dim_third_party_name UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS relationship_type (
  relationship_type_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  from_entity_type TEXT NOT NULL,
  to_entity_type TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_service_dependency (
  service_dependency_id BIGSERIAL PRIMARY KEY,
  function_id BIGINT REFERENCES dim_function(function_id),
  service_id BIGINT NOT NULL REFERENCES dim_service(service_id),
  is_critical BOOLEAN NOT NULL DEFAULT false,
  direct_channel_id BIGINT NOT NULL REFERENCES dim_direct_channel(direct_channel_id),
  application_id BIGINT NOT NULL REFERENCES dim_application(application_id),
  integration_id BIGINT NOT NULL REFERENCES dim_integration(integration_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fact_service_dependency_path UNIQUE (
    service_id,
    direct_channel_id,
    application_id,
    integration_id
  )
);

CREATE TABLE IF NOT EXISTS fact_integration_hardware_spec (
  integration_hardware_spec_id BIGSERIAL PRIMARY KEY,
  application_id BIGINT REFERENCES dim_application(application_id),
  integration_id BIGINT REFERENCES dim_integration(integration_id),
  hardware_spec_id BIGINT NOT NULL REFERENCES dim_hardware_spec(hardware_spec_id),
  is_critical BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_fact_hardware_source CHECK (
    (application_id IS NOT NULL AND integration_id IS NULL)
    OR (application_id IS NULL AND integration_id IS NOT NULL)
  ),
  CONSTRAINT uq_fact_integration_hardware_spec UNIQUE NULLS NOT DISTINCT (
    application_id,
    integration_id,
    hardware_spec_id
  )
);

CREATE TABLE IF NOT EXISTS fact_application_third_party (
  application_third_party_id BIGSERIAL PRIMARY KEY,
  function_id BIGINT REFERENCES dim_function(function_id),
  service_id BIGINT NOT NULL REFERENCES dim_service(service_id),
  direct_channel_id BIGINT NOT NULL REFERENCES dim_direct_channel(direct_channel_id),
  application_id BIGINT NOT NULL REFERENCES dim_application(application_id),
  third_party_id BIGINT NOT NULL REFERENCES dim_third_party(third_party_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fact_application_third_party UNIQUE (
    service_id,
    direct_channel_id,
    application_id,
    third_party_id
  )
);
```

## Indexes

```sql
CREATE INDEX IF NOT EXISTS ix_fact_service_dependency_service
  ON fact_service_dependency (service_id);

CREATE INDEX IF NOT EXISTS ix_fact_service_dependency_direct_channel
  ON fact_service_dependency (direct_channel_id);

CREATE INDEX IF NOT EXISTS ix_fact_service_dependency_application
  ON fact_service_dependency (application_id);

CREATE INDEX IF NOT EXISTS ix_fact_service_dependency_integration
  ON fact_service_dependency (integration_id);

CREATE INDEX IF NOT EXISTS ix_fact_integration_hardware_spec_integration
  ON fact_integration_hardware_spec (integration_id);

CREATE INDEX IF NOT EXISTS ix_fact_integration_hardware_spec_application
  ON fact_integration_hardware_spec (application_id);

CREATE INDEX IF NOT EXISTS ix_fact_application_third_party_application
  ON fact_application_third_party (application_id);
```

## Views

The setup SQL also creates:

```text
vw_service_dependency_edges
vw_service_dependency_enriched
```

Use `infra/sql/init/001_service_dependency_schema.sql` instead of copying snippets from this document when creating a real environment, because it contains the complete final schema, relationship seed data, indexes, and full view definitions.
