CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

INSERT INTO relationship_type (
  relationship_type_code,
  display_name,
  from_entity_type,
  to_entity_type,
  description
)
VALUES
  ('AVAILABLE_ON', 'Available on', 'Service', 'DirectChannel', 'A service is available on a direct channel.'),
  ('DEPENDS_ON_APP', 'Depends on', 'DirectChannel', 'Application', 'A direct channel depends on an application for the selected service path.'),
  ('DEPENDS_ON_INTEG', 'Depends on', 'Application', 'Integration', 'An application depends on an integration for the selected service path.'),
  ('RUN_BY', 'Run by', 'Application', 'ThirdParty', 'A third party runs or supports an application in a selected service/channel path.'),
  ('HAS_HARDWARE', 'Has hardware', 'Application/Integration', 'HardwareSpec', 'An application or integration uses this hardware or platform specification.'),
  ('IMPACTS', 'Impacts', 'Integration/Application', 'Application/Channel/Service', 'Reverse impact relationship used by impact analysis.')
ON CONFLICT (relationship_type_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  from_entity_type = EXCLUDED.from_entity_type,
  to_entity_type = EXCLUDED.to_entity_type,
  description = EXCLUDED.description;

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

CREATE OR REPLACE VIEW vw_service_dependency_edges AS
SELECT DISTINCT
  'Service' AS source_type,
  s.service_id AS source_id,
  s.service_name AS source_name,
  'DirectChannel' AS target_type,
  dc.direct_channel_id AS target_id,
  dc.direct_channel_name AS target_name,
  'AVAILABLE_ON' AS relationship_type
FROM fact_service_dependency f
JOIN dim_service s ON s.service_id = f.service_id
JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
UNION ALL
SELECT DISTINCT
  'DirectChannel' AS source_type,
  dc.direct_channel_id AS source_id,
  dc.direct_channel_name AS source_name,
  'Application' AS target_type,
  app.application_id AS target_id,
  app.application_name AS target_name,
  'DEPENDS_ON' AS relationship_type
FROM fact_service_dependency f
JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
JOIN dim_application app ON app.application_id = f.application_id
UNION ALL
SELECT DISTINCT
  'Application' AS source_type,
  app.application_id AS source_id,
  app.application_name AS source_name,
  'Integration' AS target_type,
  integ.integration_id AS target_id,
  integ.integration_name AS target_name,
  'DEPENDS_ON' AS relationship_type
FROM fact_service_dependency f
JOIN dim_application app ON app.application_id = f.application_id
JOIN dim_integration integ ON integ.integration_id = f.integration_id
UNION ALL
SELECT DISTINCT
  'Application' AS source_type,
  app.application_id AS source_id,
  app.application_name AS source_name,
  'ThirdParty' AS target_type,
  tp.third_party_id AS target_id,
  tp.third_party_name AS target_name,
  'RUN_BY' AS relationship_type
FROM fact_application_third_party f
JOIN dim_application app ON app.application_id = f.application_id
JOIN dim_third_party tp ON tp.third_party_id = f.third_party_id
UNION ALL
SELECT DISTINCT
  CASE WHEN f.application_id IS NOT NULL THEN 'Application' ELSE 'Integration' END AS source_type,
  COALESCE(app.application_id, integ.integration_id) AS source_id,
  COALESCE(app.application_name, integ.integration_name) AS source_name,
  'HardwareSpec' AS target_type,
  hw.hardware_spec_id AS target_id,
  hw.spec_name AS target_name,
  'HAS_HARDWARE' AS relationship_type
FROM fact_integration_hardware_spec f
LEFT JOIN dim_application app ON app.application_id = f.application_id
LEFT JOIN dim_integration integ ON integ.integration_id = f.integration_id
JOIN dim_hardware_spec hw ON hw.hardware_spec_id = f.hardware_spec_id;

CREATE OR REPLACE VIEW vw_service_dependency_enriched AS
SELECT
  fn.function_name,
  s.service_name,
  bool_or(f.is_critical) OVER (PARTITION BY f.service_id) AS service_is_critical,
  dc.direct_channel_name,
  app.application_name,
  integ.integration_name,
  COALESCE(tp.third_parties, ARRAY[]::TEXT[]) AS third_parties,
  COALESCE(hw.hardware_specs, ARRAY[]::TEXT[]) AS hardware_specs,
  COALESCE(hw.critical_hardware_specs, ARRAY[]::TEXT[]) AS critical_hardware_specs,
  COALESCE(hw.is_critical, false) AS is_critical
FROM fact_service_dependency f
LEFT JOIN dim_function fn ON fn.function_id = f.function_id
JOIN dim_service s ON s.service_id = f.service_id
JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
JOIN dim_application app ON app.application_id = f.application_id
JOIN dim_integration integ ON integ.integration_id = f.integration_id
LEFT JOIN LATERAL (
  SELECT array_agg(DISTINCT party.third_party_name ORDER BY party.third_party_name) AS third_parties
  FROM fact_application_third_party app_party
  JOIN dim_third_party party ON party.third_party_id = app_party.third_party_id
  WHERE app_party.service_id = f.service_id
    AND app_party.direct_channel_id = f.direct_channel_id
    AND app_party.application_id = f.application_id
) tp ON true
LEFT JOIN LATERAL (
  SELECT
    array_agg(DISTINCT spec.spec_category || ': ' || spec.spec_name ORDER BY spec.spec_category || ': ' || spec.spec_name) AS hardware_specs,
    array_agg(DISTINCT spec.spec_category || ': ' || spec.spec_name ORDER BY spec.spec_category || ': ' || spec.spec_name)
      FILTER (WHERE ihs.is_critical) AS critical_hardware_specs,
    bool_or(ihs.is_critical) AS is_critical
  FROM fact_integration_hardware_spec ihs
  JOIN dim_hardware_spec spec ON spec.hardware_spec_id = ihs.hardware_spec_id
  WHERE (
      ihs.integration_id = f.integration_id
      OR ihs.application_id = f.application_id
    )
) hw ON true;
