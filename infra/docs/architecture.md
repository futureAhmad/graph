# Architecture

This project uses separated NestJS API and Next.js frontend apps, with PostgreSQL as the primary SQL database.

## Backend

The API is organized by business capability:

- `graph`: repository operations, statistics, search, dependencies, and graph response shaping.
- `import`: Excel parsing, dynamic column mapping, MERGE planning.
- `impact`: impact analysis use cases.
- `service`: service dependency graph use cases.
- `search`: global node search.

The first implementation slice keeps infrastructure and application logic separated enough to grow toward Clean Architecture without creating ceremony before the domain stabilizes.

## Frontend

The web app uses Next.js App Router, TypeScript, Tailwind CSS, shadcn-style primitives, and `@xyflow/react` for graph visualization.

Pages:

- `/dashboard`: import and graph statistics.
- `/impact`: application/integration impact analysis.
- `/explorer`: service-rooted dependency graph.
- `/search`: global node search and centered graph view.

## Database

The source workbook is tabular, so the database is modeled as dimensions plus a fact table:

- dimensions for Function, Service, Direct Channel, Application, and Integration
- `fact_service_dependency` for each service dependency path
- `relationship_type` for graph relationship semantics such as `AVAILABLE_ON` and `DEPENDS_ON`

See `infra/docs/sql-database-details.md` for the full PK/FK schema.

## Scalability Notes

The browser graph should stay bounded. PostgreSQL can store the full imported dataset, but the API should return selected-service subgraphs, paginated results, or lazy-expanded branches for visualization.
