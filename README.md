# Service Dependency & Impact Analysis Platform

Production-oriented starter for dependency graph import, service exploration, and impact analysis.

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI, `@xyflow/react`
- Backend: NestJS, TypeScript, REST APIs
- Database: PostgreSQL SQL schema
- Shared contracts: TypeScript workspace package

## Project Layout

```text
frontend/          Next.js app, including src/app, src/components, and src/lib
backend/           NestJS API source and tests
packages/shared/   Shared DTOs, graph types, constants, and contracts
infra/             Docker Compose and SQL database initialization
docs/              Architecture, API, import docs, and sample workbooks
```

Generated folders such as `node_modules`, `.next`, `dist`, and SQL runtime data are ignored and can be recreated.
The sample import workbook is in `docs/import-samples/test.xlsx`.
Database details are in `docs/sql-database-details.md`.

## Setup

```bash
npm install
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
npm run dev:api
npm run dev:web
```

Frontend: `http://localhost:3000`

Backend: `http://localhost:3001`

Swagger: `http://localhost:3001/docs`

PostgreSQL: `127.0.0.1:55432`

Default PostgreSQL credentials:

- database: `service_dependency`
- user: `service_dependency`
- password: `password`

## Current Implementation Phase

Implemented:

- Monorepo structure
- Shared DTOs and graph contracts
- NestJS API modules
- SQL schema for dimension and fact tables
- Three-sheet Excel import engine for dependencies, hardware specs, criticality, and third parties
- Impact and dependency APIs
- Next.js app shell
- XYFlow graph canvas
- Dashboard, import, impact, explorer, and search pages
- Initial docs and unit test coverage for dynamic column mapping

Next recommended phase:

- Add Dockerized API/Web services
- Add integration tests with test PostgreSQL
- Add import history endpoints
- Add expand/collapse and server-side graph pagination
- Add PNG/SVG export controls
