# SQL Database Details

## Purpose

PostgreSQL stores the three-sheet `test.xlsx` workbook as normalized dimensions plus fact/bridge tables. The API then builds graph DTOs for service exploration and reverse impact analysis.

## Tables

### `import_batch`

Tracks each workbook load.

| Column | Type | Key | Notes |
| --- | --- | --- | --- |
| `import_batch_id` | UUID | PK | Import id |
| `dataset_id` | TEXT |  | Defaults to `default` |
| `source_file` | TEXT |  | Workbook filename |
| `source_sheet` | TEXT |  | Imported sheet names |
| `rows_read` | INTEGER |  | Parsed rows |
| `rows_imported` | INTEGER |  | Valid dependency path rows |
| `imported_at` | TIMESTAMPTZ |  | Import timestamp |

### Dimensions

| Table | Primary Key | Natural Unique Key | Purpose |
| --- | --- | --- | --- |
| `dim_function` | `function_id` | `normalized_name` | Stores `function name` for lineage |
| `dim_service` | `service_id` | `normalized_name` | Services selected by the user |
| `dim_direct_channel` | `direct_channel_id` | `normalized_name` | Delivery channels such as `branch` and `mobile` |
| `dim_application` | `application_id` | `normalized_name` | Applications such as `CRM`, `IB WEB`, `SUPER APP` |
| `dim_integration` | `integration_id` | `normalized_name` | Integrations such as `IBM`, `MQ`, `LIQ2` |
| `dim_hardware_spec` | `hardware_spec_id` | `normalized_name` | Hardware/platform specs from Sheet2 |
| `dim_third_party` | `third_party_id` | `normalized_name` | Third-party providers from Sheet3 |

`dim_hardware_spec` includes:

| Column | Type | Notes |
| --- | --- | --- |
| `spec_name` | TEXT | Original cell value, for example `PALO ALTO FIREWALL` |
| `spec_category` | TEXT | Classified value such as `firewall`, `server`, `database`, `other` |

### `relationship_type`

Documents graph relationship semantics.

| Code | From | To | Meaning |
| --- | --- | --- | --- |
| `AVAILABLE_ON` | Service | DirectChannel | Service is available on a channel |
| `DEPENDS_ON_APP` | DirectChannel | Application | Channel uses an application |
| `DEPENDS_ON_INTEG` | Application | Integration | Application uses an integration |
| `RUN_BY` | Application | ThirdParty | Third party runs/supports an application path |
| `HAS_HARDWARE` | Integration | HardwareSpec | Integration uses a hardware/platform spec |
| `IMPACTS` | Integration/Application | Application/Channel/Service | Reverse impact graph relationship |

### `fact_service_dependency`

Stores one dependency path per Sheet1 row.

```text
Function + Service + Direct Channel + Application + Integration
```

Foreign keys:

```text
import_batch.import_batch_id -> fact_service_dependency.import_batch_id
dim_function.function_id -> fact_service_dependency.function_id
dim_service.service_id -> fact_service_dependency.service_id
dim_direct_channel.direct_channel_id -> fact_service_dependency.direct_channel_id
dim_application.application_id -> fact_service_dependency.application_id
dim_integration.integration_id -> fact_service_dependency.integration_id
```

Unique path:

```text
dataset_id + service_id + direct_channel_id + application_id + integration_id
```

### `fact_integration_hardware_spec`

Stores Sheet2 rows.

| Column | Key | Notes |
| --- | --- | --- |
| `integration_id` | FK | References `dim_integration` |
| `hardware_spec_id` | FK | References `dim_hardware_spec` |
| `is_critical` |  | Boolean derived from `is_critical` |
| `criticality_label` |  | Original criticality text |

Unique path:

```text
dataset_id + integration_id + hardware_spec_id
```

### `fact_application_third_party`

Stores Sheet3 rows.

| Column | Key | Notes |
| --- | --- | --- |
| `function_id` | FK | Optional lineage |
| `service_id` | FK | Service context |
| `direct_channel_id` | FK | Channel context |
| `application_id` | FK | Application context |
| `third_party_id` | FK | Provider |

Unique path:

```text
dataset_id + service_id + direct_channel_id + application_id + third_party_id
```

## Views

### `vw_service_dependency_edges`

Returns graph-like edges from SQL:

```text
dataset_id, source_type, source_id, source_name,
target_type, target_id, target_name, relationship_type
```

It includes `AVAILABLE_ON`, `DEPENDS_ON`, `RUN_BY`, and `HAS_HARDWARE`.

### `vw_service_dependency_enriched`

Returns dependency rows enriched with Sheet2 and Sheet3 data:

```text
function_name
service_name
direct_channel_name
application_name
integration_name
third_parties
hardware_specs
critical_hardware_specs
is_critical
```

Use this view to preview the workbook data in SQL after import.

## Graph Behavior

Service exploration:

```text
Service -> DirectChannel -> Application -> Integration
```

Hardware specs and third parties stay in SQL and are returned as selected-node details. They are not drawn as service exploration graph nodes.

Impact analysis is reverse-rooted:

```text
Integration -> affected Applications -> affected DirectChannels -> affected Services
```

Example verified from the current `test.xlsx`:

```text
LIQ2 -> IB WEB -> mobile -> commudity
LIQ2 -> SUPER APP -> mobile -> commudity
```

## Schema File

```text
infra/sql/init/001_service_dependency_schema.sql
```
