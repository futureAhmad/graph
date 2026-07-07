# Import Format

The Excel import expects the same three-sheet structure as `test.xlsx`.

## Sheet 1: Dependency Paths

Required columns:

- `function name`
- `service name`
- `dc`
- `app`
- `integ`

Rows are imported as:

```text
Service -> Direct Channel -> Application -> Integration
```

The user selects only `service name` in the frontend. `function name` is stored for lineage/reporting, but it is not selected by the user and is not the graph root.

## Sheet 2: Integration Hardware Specifications

Required columns:

- `integ`
- `spec`
- `is_critical`

Each row maps one integration to one hardware/platform specification.

The original `spec` text is preserved in `dim_hardware_spec.spec_name`. The importer also classifies the spec into `spec_category`, such as:

- `server`
- `database`
- `firewall`
- `load_balancer`
- `os`
- `virtualization`
- `backup`
- `dns`
- `storage`
- `network`
- `middleware`
- `other`

`is_critical` is converted to a boolean. Values such as `CRITICAL`, `yes`, `true`, and `1` are treated as critical.

## Sheet 3: Third Parties

Required columns:

- `function name`
- `service name`
- `dc`
- `app`
- `thrid party`

The misspelled workbook header `thrid party` is supported. `third party`, `vendor`, and `provider` are also accepted.

Rows are imported as third-party relationships for a specific service/channel/application path:

```text
Application -> Third Party
```

## Relationship Rules

- `Service -> DirectChannel`: `AVAILABLE_ON`
- `DirectChannel -> Application`: `DEPENDS_ON`
- `Application -> Integration`: `DEPENDS_ON`
- `Application -> ThirdParty`: `RUN_BY`
- `Integration -> HardwareSpec`: `HAS_HARDWARE`
- Reverse impact graph: `IMPACTS`

## Visual Graph Rules

Service exploration is service-rooted. The graph canvas shows only the operational dependency path:

```text
Service -> Direct Channel -> Application -> Integration
```

Applications are duplicated visually under different direct channels to avoid crossed edges. Integrations are unique within each direct channel, so two apps in the same channel connect to the same integration node when they share it.

Hardware specifications and third parties are not drawn as graph nodes in service exploration. They are attached to the relevant selected node and shown in the frontend selected-node details panel.

Impact analysis is reverse-rooted. If the user selects an integration such as `LIQ2`, the graph is:

```text
Integration -> affected Applications -> affected Direct Channels -> affected Services
```
