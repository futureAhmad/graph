BEGIN;

TRUNCATE TABLE
  fact_application_third_party,
  fact_integration_hardware_spec,
  fact_service_dependency,
  dim_third_party,
  dim_hardware_spec,
  dim_integration,
  dim_application,
  dim_direct_channel,
  dim_service,
  dim_function
RESTART IDENTITY CASCADE;

INSERT INTO dim_function (function_name, normalized_name)
SELECT name, lower(regexp_replace(name, '\s+', ' ', 'g'))
FROM (
  VALUES
    ('Retail Banking'),
    ('Corporate Banking'),
    ('Digital Channels'),
    ('Payments'),
    ('Treasury'),
    ('Risk Management'),
    ('Customer Operations'),
    ('Finance'),
    ('Compliance'),
    ('Data And Analytics')
) AS source(name);

INSERT INTO dim_direct_channel (direct_channel_name, normalized_name)
SELECT name, lower(regexp_replace(name, '\s+', ' ', 'g'))
FROM (
  VALUES
    ('Mobile App'),
    ('Internet Banking'),
    ('Branch'),
    ('ATM'),
    ('Call Center'),
    ('Open Banking API'),
    ('Back Office'),
    ('Partner Portal')
) AS source(name);

INSERT INTO dim_service (service_name, normalized_name)
SELECT
  'Service ' || lpad(series::text, 3, '0') || ' - ' ||
  (ARRAY[
    'Account Opening',
    'Funds Transfer',
    'Card Management',
    'Loan Origination',
    'Bill Payment',
    'Customer Profile',
    'Corporate Payroll',
    'Trade Finance',
    'Treasury Deal',
    'Fraud Monitoring'
  ])[((series - 1) % 10) + 1],
  lower(
    regexp_replace(
      'Service ' || lpad(series::text, 3, '0') || ' - ' ||
      (ARRAY[
        'Account Opening',
        'Funds Transfer',
        'Card Management',
        'Loan Origination',
        'Bill Payment',
        'Customer Profile',
        'Corporate Payroll',
        'Trade Finance',
        'Treasury Deal',
        'Fraud Monitoring'
      ])[((series - 1) % 10) + 1],
      '\s+',
      ' ',
      'g'
    )
  )
FROM generate_series(1, 140) AS series;

INSERT INTO dim_application (application_name, normalized_name)
SELECT
  'App ' || lpad(series::text, 3, '0') || ' - ' ||
  (ARRAY[
    'Core Adapter',
    'Workflow Engine',
    'Customer Hub',
    'Payment Gateway',
    'Risk Rules',
    'Document Service',
    'Notification Service',
    'Reporting Mart',
    'API Gateway',
    'Case Manager'
  ])[((series - 1) % 10) + 1],
  lower(
    regexp_replace(
      'App ' || lpad(series::text, 3, '0') || ' - ' ||
      (ARRAY[
        'Core Adapter',
        'Workflow Engine',
        'Customer Hub',
        'Payment Gateway',
        'Risk Rules',
        'Document Service',
        'Notification Service',
        'Reporting Mart',
        'API Gateway',
        'Case Manager'
      ])[((series - 1) % 10) + 1],
      '\s+',
      ' ',
      'g'
    )
  )
FROM generate_series(1, 220) AS series;

INSERT INTO dim_integration (integration_name, normalized_name)
SELECT
  'Integration ' || lpad(series::text, 3, '0') || ' - ' ||
  (ARRAY[
    'T24',
    'CRM',
    'SWIFT',
    'SADAD',
    'MADA',
    'AML',
    'Data Lake',
    'ESB',
    'KYC',
    'Credit Bureau'
  ])[((series - 1) % 10) + 1],
  lower(
    regexp_replace(
      'Integration ' || lpad(series::text, 3, '0') || ' - ' ||
      (ARRAY[
        'T24',
        'CRM',
        'SWIFT',
        'SADAD',
        'MADA',
        'AML',
        'Data Lake',
        'ESB',
        'KYC',
        'Credit Bureau'
      ])[((series - 1) % 10) + 1],
      '\s+',
      ' ',
      'g'
    )
  )
FROM generate_series(1, 260) AS series;

INSERT INTO dim_third_party (third_party_name, normalized_name)
SELECT
  'Vendor ' || lpad(series::text, 2, '0') || ' - ' ||
  (ARRAY[
    'Cloud Operations',
    'Payment Processor',
    'Risk Platform',
    'Messaging Provider',
    'Document Provider',
    'Security Services',
    'Data Provider',
    'Integration Partner'
  ])[((series - 1) % 8) + 1],
  lower(
    regexp_replace(
      'Vendor ' || lpad(series::text, 2, '0') || ' - ' ||
      (ARRAY[
        'Cloud Operations',
        'Payment Processor',
        'Risk Platform',
        'Messaging Provider',
        'Document Provider',
        'Security Services',
        'Data Provider',
        'Integration Partner'
      ])[((series - 1) % 8) + 1],
      '\s+',
      ' ',
      'g'
    )
  )
FROM generate_series(1, 36) AS series;

INSERT INTO dim_hardware_spec (spec_name, spec_category, normalized_name)
SELECT
  category || ' Tier ' || tier,
  category,
  lower(category || ' tier ' || tier)
FROM (
  SELECT unnest(ARRAY['server', 'os', 'virtualization', 'load_balancer', 'firewall', 'backup', 'storage', 'db', 'dns']) AS category
) categories
CROSS JOIN generate_series(1, 12) AS tier;

INSERT INTO fact_service_dependency (
  function_id,
  service_id,
  is_critical,
  direct_channel_id,
  application_id,
  integration_id
)
SELECT DISTINCT
  ((service_id - 1) % 10) + 1,
  service_id,
  service_id % 4 = 0 OR service_id % 11 = 0,
  ((service_id + channel_offset - 2) % 8) + 1,
  ((service_id * 3 + channel_offset * 11 + app_offset * 17 - 1) % 220) + 1,
  ((service_id * 5 + channel_offset * 13 + app_offset * 19 - 1) % 260) + 1
FROM generate_series(1, 140) AS service_id
CROSS JOIN generate_series(1, 5) AS channel_offset
CROSS JOIN generate_series(1, 4) AS app_offset
ON CONFLICT (service_id, direct_channel_id, application_id, integration_id) DO NOTHING;

INSERT INTO fact_application_third_party (
  function_id,
  service_id,
  direct_channel_id,
  application_id,
  third_party_id
)
SELECT DISTINCT
  function_id,
  service_id,
  direct_channel_id,
  application_id,
  ((application_id * 7 + service_id * 3 + vendor_offset * 5 - 1) % 36) + 1
FROM fact_service_dependency
CROSS JOIN generate_series(1, 2) AS vendor_offset
WHERE application_id % 3 <> 0
ON CONFLICT (service_id, direct_channel_id, application_id, third_party_id) DO NOTHING;

INSERT INTO fact_integration_hardware_spec (
  application_id,
  integration_id,
  hardware_spec_id,
  is_critical
)
SELECT DISTINCT
  application_id,
  NULL::BIGINT,
  ((application_id * 5 + spec_offset * 7 - 1) % 108) + 1,
  application_id % 5 = 0 OR spec_offset = 1
FROM dim_application
CROSS JOIN generate_series(1, 3) AS spec_offset
ON CONFLICT (application_id, integration_id, hardware_spec_id) DO NOTHING;

INSERT INTO fact_integration_hardware_spec (
  application_id,
  integration_id,
  hardware_spec_id,
  is_critical
)
SELECT DISTINCT
  NULL::BIGINT,
  integration_id,
  ((integration_id * 11 + spec_offset * 13 - 1) % 108) + 1,
  integration_id % 4 = 0 OR spec_offset = 1
FROM dim_integration
CROSS JOIN generate_series(1, 4) AS spec_offset
ON CONFLICT (application_id, integration_id, hardware_spec_id) DO NOTHING;

COMMIT;

SELECT
  (SELECT count(*) FROM dim_service) AS services,
  (SELECT count(*) FROM fact_service_dependency) AS service_paths,
  (SELECT count(*) FROM dim_application) AS applications,
  (SELECT count(*) FROM dim_integration) AS integrations,
  (SELECT count(*) FROM dim_third_party) AS third_parties,
  (SELECT count(*) FROM fact_application_third_party) AS third_party_links,
  (SELECT count(*) FROM fact_integration_hardware_spec) AS hardware_links;
