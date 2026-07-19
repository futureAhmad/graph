# REST API

Base URL: `http://localhost:3001`

## Import

`POST /import`

Multipart form fields:

- `file`: `.xlsx` or `.xls`
- `datasetId`: optional, defaults to `default`
- `sourceName`: optional

Returns import statistics.

The workbook must follow the three-sheet `test.xlsx` structure:

- Sheet1: service dependency paths
- Sheet2: integration hardware specifications and criticality
- Sheet3: application third parties

## Impact

`GET /impact/app/:name`

`GET /impact/integ/:name`

Query params:

- `datasetId`: optional, defaults to `default`

Returns affected services, affected direct channels, dependency tree, graph, and impact level.

For integration impact, the returned graph is reverse-rooted:

```text
Integration -> affected Applications -> affected Direct Channels -> affected Services
```

## Service Dependencies

`GET /service/:name/dependencies`

Returns an XYFlow-compatible graph DTO.

## Search

`GET /search?q=:query&limit=20`

Returns matching graph nodes.

## Graph

`GET /graph/statistics`

Returns total nodes, relationships, and node counts by type.

`GET /graph/node/:entityKey/neighbors`

Returns the immediate graph around a node.
