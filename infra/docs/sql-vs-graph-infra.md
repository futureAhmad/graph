# SQL vs Graph Infrastructure

## Current Data Shape

`test.xlsx` is tabular and hierarchical:

```text
function name | service name | dc | app | integ
```

The graph shown to the user is generated from a selected Service:

```text
Service -> Direct Channel -> Application -> Integration
```

For this data shape, SQL is a strong fit because each Excel row is already a fact record that can be normalized into dimensions.

## SQL Option

### Suggested Tables

Dimension tables:

```text
dim_function
dim_service
dim_direct_channel
dim_application
dim_integration
```

Fact table:

```text
fact_service_dependency
```

Example fact columns:

```text
id
function_id
service_id
direct_channel_id
application_id
integration_id
source_file
source_sheet
source_row
created_at
```

### Why SQL Fits

- The source is Excel, which is tabular.
- The hierarchy depth is currently fixed and clear.
- Duplicate applications under different DCs are easy to represent because each Excel row remains a separate fact path.
- Reporting is easier: counts by service, channel, app, integration, import file, etc.
- Data quality constraints are straightforward with unique keys and foreign keys.
- SQL is easier to inspect manually with normal tables.
- Backups, migrations, BI tools, and operational support are usually simpler.

### SQL Tradeoffs

- Recursive or highly dynamic dependency paths are more awkward than in a graph database.
- If future dependency levels become unknown/unlimited, the schema may need either new columns or a generic edge table.
- Visual graph APIs still need to transform SQL rows into tree nodes and edges for the frontend.

### Recommended SQL Query Shape

For a selected service:

```sql
SELECT
  s.name AS service_name,
  dc.name AS direct_channel_name,
  app.name AS application_name,
  integ.name AS integration_name
FROM fact_service_dependency f
JOIN dim_service s ON s.service_id = f.service_id
JOIN dim_direct_channel dc ON dc.direct_channel_id = f.direct_channel_id
JOIN dim_application app ON app.application_id = f.application_id
JOIN dim_integration integ ON integ.integration_id = f.integration_id
WHERE s.name = $1
ORDER BY dc.name, app.name, integ.name;
```

The backend can then build a visual tree:

```text
Service
  DC
    App
      Integ
```

If the same App appears under two DCs, the API returns it twice in the visual tree, while the SQL dimension still stores the App once.

## Neo4j Graph Option

### Current Graph Model

```text
(:Service)-[:AVAILABLE_ON]->(:DirectChannel)
(:DirectChannel)-[:DEPENDS_ON]->(:Application)
(:Application)-[:DEPENDS_ON]->(:Integration)
```

### Why Neo4j Fits

- Natural traversal when dependency depth becomes unknown.
- Good for impact analysis across many relationship types.
- Good for questions like “what depends on this integration?” or “show all upstream/downstream paths.”
- Relationship-first modeling is expressive when dependencies become complex.

### Neo4j Tradeoffs

- More operational complexity than SQL for this dataset.
- Harder to inspect for users who expect tables.
- Excel row lineage and reporting are less natural than SQL facts.
- Duplicate visual nodes still need special API handling to avoid spaghetti graphs.
- If the hierarchy remains fixed, Neo4j is more infrastructure than needed.

## Recommendation

Use SQL as the primary store for this project.

Reason: the real source data is Excel-like, shallow, and structured. A star-schema model with dimensions and a dependency fact table will be easier to maintain, inspect, import, validate, and report on.

Keep Neo4j only if future requirements need flexible, unknown-depth dependency traversal or complex cross-domain impact analysis.

## Implemented SQL Direction

The project now uses PostgreSQL infrastructure and a SQL-backed repository path.

Implemented pieces:

1. PostgreSQL Docker Compose service.
2. SQL schema under `infra/sql/init`.
3. Dimension tables and `fact_service_dependency`.
4. Backend repository that imports workbook rows into SQL.
5. Frontend graph still receives `nodes[]`, `edges[]`, and `rootNodeId`.

The frontend does not need to know whether the backend uses SQL or Neo4j. It should keep receiving:

```text
nodes[]
edges[]
rootNodeId
```
