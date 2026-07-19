# SQL Database Details

## Purpose

PostgreSQL stores the three-sheet `test.xlsx` workbook as normalized dimensions plus fact/bridge tables. The API then builds graph DTOs for service exploration and reverse impact analysis.

## Tables

### Authentication

| Table | Primary Key | Purpose |
| --- | --- | --- |
| `app_user` | `user_id` | Login accounts for the web app |

`app_user` stores `username`, `display_name`, `password_hash`, `role`, and `is_approved`. Usernames contain letters only. Valid roles are `admin` and `user`.

Login creates a signed HTTP-only browser cookie named `sid`. The cookie stores the user id and expiry in a signed payload and expires after 24 hours. Sessions are not stored in the database.

When `app_user` is empty, the first successful `/auth/login` request creates that username/password as the initial approved `admin` user. After that, unknown usernames are added as pending users and cannot log in until an admin approves them.

Admins can manage users through the `/users` API and can add service paths through `/admin/service-paths`.

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
| `spec_category` | TEXT | Source column category such as `firewall`, `server`, `db`, `os` |

### `relationship_type`

Documents graph relationship semantics.

| Code | From | To | Meaning |
| --- | --- | --- | --- |
| `AVAILABLE_ON` | Service | DirectChannel | Service is available on a channel |
| `DEPENDS_ON_APP` | DirectChannel | Application | Channel uses an application |
| `DEPENDS_ON_INTEG` | Application | Integration | Application uses an integration |
| `RUN_BY` | Application | ThirdParty | Third party runs/supports an application path |
| `HAS_HARDWARE` | Application/Integration | HardwareSpec | Application or integration uses a hardware/platform spec |
| `IMPACTS` | Integration/Application | Application/Channel/Service | Reverse impact graph relationship |

### `fact_service_dependency`

Stores one dependency path per Sheet1 row.

```text
Function + Service + Direct Channel + Application + Integration
```

Foreign keys:

```text
dim_function.function_id -> fact_service_dependency.function_id
dim_service.service_id -> fact_service_dependency.service_id
dim_direct_channel.direct_channel_id -> fact_service_dependency.direct_channel_id
dim_application.application_id -> fact_service_dependency.application_id
dim_integration.integration_id -> fact_service_dependency.integration_id
```

`fact_service_dependency.is_critical` stores the Sheet1 `critical_service` value for the selected service path.

Admin-created service paths are stored here as well. New service, direct channel, application, and integration names are upserted into their dimension tables using `normalized_name`.

Unique path:

```text
service_id + direct_channel_id + application_id + integration_id
```

### `fact_integration_hardware_spec`

Stores Sheet2 rows.

| Column | Key | Notes |
| --- | --- | --- |
| `application_id` | FK | References `dim_application` when Sheet2 `source` matches an app |
| `integration_id` | FK | References `dim_integration` when Sheet2 `source` matches an integration |
| `hardware_spec_id` | FK | References `dim_hardware_spec` |
| `is_critical` |  | Boolean derived from the matching `*_is_critical` column |

Unique path:

```text
application_id + integration_id + hardware_spec_id
```

Admin-created hardware specs are stored here when an admin attaches a spec to an application or integration.

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
service_id + direct_channel_id + application_id + third_party_id
```

Admin-created third-party relationships are stored here when an admin attaches a provider to the service/channel/application path.

## Views

### `vw_service_dependency_edges`

Returns graph-like edges from SQL:

```text
source_type, source_id, source_name, target_type, target_id, target_name, relationship_type
```

It includes `AVAILABLE_ON`, `DEPENDS_ON`, `RUN_BY`, and `HAS_HARDWARE`.

### `vw_service_dependency_enriched`

Returns dependency rows enriched with Sheet2 and Sheet3 data:

```text
function_name
service_name
service_is_critical
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

Third parties are shown above the service level in service exploration. Hardware specs stay in SQL and are returned as selected-node details.

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
