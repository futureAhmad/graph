# Import Format

The Excel import expects the same three-sheet structure as `test.xlsx`.

## Sheet 1: Dependency Paths

Required columns:

- `function name`
- `service name`
- `dc`
- `critical_service`
- `app`
- `integ`

Rows are imported as:

```text
Service -> Direct Channel -> Application -> Integration
```

The user selects only `service name` in the frontend. `function name` is stored for lineage/reporting, but it is not selected by the user and is not the graph root.
`critical_service` is stored as the service criticality flag shown in Explore.

## Sheet 2: Hardware Specifications

Required columns:

- `source`

Supported hardware value columns:

- `server`
- `os`
- `virtualization`
- `load_balancer`
- `firewall`
- `backup`
- `storage`
- `db`
- `DNS_REQUIRED`

Each hardware column can have a matching criticality column such as `server_is_critical`, `os_is_critical`, or `db_is_critical`.

Each row maps `source` to hardware/platform specifications. `source` must match either an `app` or an `integration` value from Sheet 1. Hardware is stored once in `dim_hardware_spec` and linked to the matching application or integration.

The original hardware cell value is preserved in `dim_hardware_spec.spec_name`. The importer stores the source column category in `spec_category`, such as:

- `server`
- `db`
- `firewall`
- `load_balancer`
- `os`
- `virtualization`
- `backup`
- `dns`
- `storage`

Criticality values such as `CRITICAL`, `yes`, `true`, and `1` are treated as critical. Values such as `no`, `false`, `0`, `none`, `n/a`, and `not required` are skipped when they appear in hardware value columns.

## Sheet 3: Third Parties

Required columns:

- `function name`
- `service name`
- `dc`
- `app`
- `thrid`
- `type`
- `Company name`

The importer stores `Company name` in `dim_third_party`. If `Company name` is blank, it falls back to parsing the company from the final parentheses in `thrid`, for example `Payment gateway (Acme Pay)` becomes `Acme Pay`.

Rows are imported as third-party relationships for a specific service/channel/application path:

```text
Application -> Third Party
```

## Relationship Rules

- `Service -> DirectChannel`: `AVAILABLE_ON`
- `DirectChannel -> Application`: `DEPENDS_ON`
- `Application -> Integration`: `DEPENDS_ON`
- `Application -> ThirdParty`: `RUN_BY`
- `Application/Integration -> HardwareSpec`: `HAS_HARDWARE`
- Reverse impact graph: `IMPACTS`

## Visual Graph Rules

Service exploration is service-rooted. Third parties appear one level above the service, and the operational dependency path remains:

```text
Third Party -> Service -> Direct Channel -> Application -> Integration
```

Applications are duplicated visually under different direct channels to avoid crossed edges. Integrations are unique within each direct channel, so two apps in the same channel connect to the same integration node when they share it.

Hardware specifications are attached to the relevant selected node and shown in the frontend selected-node details panel.

Impact analysis is reverse-rooted. If the user selects an integration such as `LIQ2`, the graph is:

```text
Integration -> affected Applications -> affected Direct Channels -> affected Services
```
