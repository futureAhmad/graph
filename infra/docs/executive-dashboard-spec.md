Act as a senior full-stack engineer, data analytics architect, and executive dashboard designer.

Inspect the entire existing repository before making changes. Understand the current architecture, database schema, relationships, API conventions, UI components, theme, routing, authentication, naming conventions, and coding style. Reuse the existing implementation patterns and do not create a parallel architecture.

Your task is to design and implement a production-quality Executive Management Insights Dashboard using MUI X Charts.

The dashboard must transform the existing service dependency data into decision-oriented metrics for senior management.

Important constraints:

- Do not build an inventory page.
- Do not display large lists of services, applications, integrations, hardware specifications, or third parties.
- Do not place thousands of entities in chart axes, legends, filters, or tables.
- Use aggregated counts, percentages, ratios, concentration indicators, criticality indicators, and management insights.
- Functions are limited to roughly seven, so functions may be displayed individually.
- Third-party charts may show only the top 10 or top 15 ranked companies.
- Application and integration charts may show only the highest-impact entities.
- All counts must use the correct distinct business entity IDs rather than raw fact-table row counts.
- Avoid double-counting caused by repeated dependency paths.
- All data must come from the real backend and database. Do not use hardcoded or mock dashboard values.
- Perform aggregation in SQL or the backend, not by loading all dependency records into the browser.
- Preserve the current application design language and dark/light theme behavior.
- Use the project’s existing shared UI components wherever appropriate.

Before implementation:

1. Inspect the repository structure.
2. Identify the frontend framework and MUI/MUI X Charts versions.
3. Locate the database schema, models, repositories, services, controllers, API clients, shared TypeScript types, routing, and existing dashboard components.
4. Understand how criticality is currently represented.
5. Understand how service paths, third parties, applications, integrations, hardware specifications, channels, and functions are related.
6. Identify existing API and error-handling conventions.
7. Check whether an analytics or dashboard page already exists and extend it instead of duplicating it.

Implement the dashboard with the following structure.

## 1. Executive overview KPI cards

Create a responsive KPI section showing:

- Total distinct services
- Total business functions
- Total distinct applications
- Total distinct integrations
- Total third parties
- Total distinct critical services
- Critical services as a percentage of all services
- Distinct services with at least one third-party dependency
- Third-party-dependent services as a percentage of all services
- Distinct services exposed to critical hardware
- Average distinct applications per service
- Average distinct integrations per service

Each card must include:

- A concise executive title
- A formatted value
- A one-sentence interpretation
- An information tooltip explaining the calculation
- A semantic severity or status where meaningful
- Proper loading, empty, and error states

Never calculate totals from the number of fact rows.

## 2. Service portfolio by business function

Create a MUI X `BarChart` showing each business function with:

- Total distinct services
- Distinct critical services

Sort functions by total service count descending.

The tooltip must show:

- Function name
- Total distinct services
- Distinct critical services
- Percentage of the total service portfolio
- Function criticality rate

Add a concise generated insight underneath, for example:

“Retail Banking and Payments represent 54% of the service portfolio.”

The insight must be computed from the returned data, not hardcoded.

## 3. Criticality rate by function

Create a horizontal MUI X `BarChart` showing:

critical distinct services / total distinct services

for every business function.

Display the value as a percentage and sort descending.

This chart must help management distinguish a large function from a function with unusually high proportional criticality.

## 4. Third-party service exposure

Create a horizontal MUI X `BarChart` for the top 10 third parties ranked by the number of distinct services depending on each company.

For each company, return and expose through the tooltip:

- Distinct services supported
- Distinct critical services supported
- Distinct applications supported
- Distinct functions exposed
- Percentage of all services exposed
- Critical-service exposure rate

Do not use fact-row count as the metric.

Add computed management flags where applicable:

- Enterprise-wide dependency
- High critical concentration
- Cross-function dependency
- Function-concentrated dependency

Use transparent, defensible thresholds stored as named constants rather than unexplained magic numbers.

## 5. Third-party concentration risk

Create a MUI X `ScatterChart` where:

- X-axis = distinct services supported
- Y-axis = distinct critical services supported
- Each point = one third party

Use a custom tooltip containing:

- Company name
- Service exposure
- Critical-service exposure
- Functions exposed
- Applications supported
- Criticality rate

Add median or percentile reference thresholds when supported cleanly by the installed MUI version. Otherwise, provide a nearby quadrant legend or classification badge.

Classify third parties into:

- High exposure / high criticality
- High exposure / lower criticality
- Lower exposure / high criticality
- Lower exposure / lower criticality

Avoid labeling every point. Label only major outliers when technically practical.

## 6. Application impact concentration

Create a h
orizontal MUI X `BarChart` for the top 10 applications ranked by distinct dependent services.

For each application calculate:

- Distinct dependent services
- Distinct critical dependent services
- Distinct functions
- Distinct direct channels
- Distinct integrations
- Distinct third parties
- Distinct hardware specifications

The chart must answer:

“Which applications would create the broadest business impact if unavailable?”

Add computed indicators such as:

- Enterprise-shared application
- Cross-function application
- Highly interconnected application
- Potential concentration risk

Do not claim that an application is definitively a single point of failure unless the schema proves there are no alternatives. Label it as a concentration-risk indicator when alternatives cannot be established.

## 7. Integration impact concentration

Create a horizontal MUI X `BarChart` for the top 10 integrations ranked by the number of distinct services indirectly depending on them.

Tooltip metrics:

- Distinct affected services
- Distinct critical services
- Distinct applications using the integration
- Distinct functions exposed
- Distinct channels exposed
- Critical hardware specifications
- Total hardware specifications

This chart must answer:

“Which integrations have the largest potential blast radius?”

## 8. Dependency complexity by function

Create a chart comparing business functions using normalized complexity metrics, including:

- Average distinct applications per service
- Average distinct integrations per service
- Average distinct third parties per service
- Average dependency paths per service

Use a grouped bar chart only if the values remain readable. Otherwise, implement a metric selector that switches between these measures.

Do not combine incompatible scales in a misleading way.

Add an insight identifying:

- The function with the greatest dependency complexity
- The function with the highest third-party intensity
- The function with the highest integration intensity

## 9. Critical exposure summary

Create a compact chart showing distinct services grouped into management-relevant exposure categories such as:

- Critical service
- Third-party dependent
- Critical-hardware exposed
- Both third-party and critical-hardware exposed

Because categories may overlap, do not use a pie or donut chart unless the categories are made mutually exclusive.

Prefer a bar chart for overlapping metrics.

Clearly explain that overlapping exposure counts should not be summed.

## 10. Executive insights panel

Create a panel containing 4–6 automatically generated insights based on the analytics response.

Examples of valid insights:

- The top two functions account for X% of all services.
- X% of critical services depend on the top three third parties.
- Application A supports X services across Y functions.
- Integration B has the highest estimated service impact.
- Function C has the highest criticality rate despite not having the largest service portfolio.
- X services are exposed to both external providers and critical hardware.

Insights must:

- Be generated deterministically from backend metrics
- Include actual calculated values
- Be concise and management-oriented
- Avoid unsupported causal claims
- Avoid describing ordinary totals as risks without context
- Include severity levels such as Information, Attention, High, or Critical when justified

## Backend requirements

Create efficient analytics queries and endpoints following the repository’s current conventions.

Prefer one consolidated dashboard endpoint when this is consistent with the architecture, for example:

GET /api/analytics/executive-dashboard

The exact route and layer names must follow the existing project conventions.

Return a typed response shaped approximately as:

- summary
- servicesByFunction
- functionCriticality
- topThirdParties
- thirdPartyRisk
- topApplications
- topIntegrations
- complexityByFunction
- exposureSummary
- insights
- generatedAt

Do not issue a separate network request for every card or chart unless the current architecture strongly requires it.

SQL requirements:

- Use `COUNT(DISTINCT ...)` where business entities may repeat across dependency paths.
- Carefully handle nullable functions.
- Decide whether unassigned functions should appear as “Unassigned” and apply that rule consistently.
- Use `NULLIF` to prevent division by zero.
- Use numeric casting to avoid integer division.
- Avoid multiplicative joins that inflate counts.
- Pre-aggregate third parties and hardware before combining them with service dependencies.
- Add or recommend indexes only when supported by query plans or clearly relevant filter/join columns.
- Do not modify existing schema constraints without a justified need.
- Keep analytics queries deterministic.
- Include tests for double-counting scenarios.

## Frontend requirements

Use React, TypeScript, and the installed MUI X Charts version.

Requirements:

- Use the existing API client pattern.
- Add strict response types.
- Use responsive chart containers.
- Ensure charts work on desktop and tablet layouts.
- Use horizontal bars for ranked charts with long labels.
- Sort ranked data in the backend or deterministically in the frontend.
- Use compact number formatting for large values.
- Use accessible chart titles and descriptions.
- Provide custom tooltips where default tooltips do not communicate enough context.
- Prevent label overlap and truncation where possible.
- Support dark and light themes.
- Do not use random colors.
- Use a restrained semantic color system consistently:
  - Neutral/default for scale
  - Warning for concentration
  - Error for high critical exposure
  - Success only for genuinely positive states
- Do not imply that a large service count is automatically negative.
- Add skeleton loading states.
- Add useful empty states.
- Add an error state with a retry action.
- Avoid unnecessary animations on initial rendering if they harm executive readability.
- Keep chart legends concise.
- Do not show raw IDs.
- Format percentages consistently.
- Show the analytics generation timestamp or “Data as of” value.

## Page layout

Use a polished executive layout:

1. Page heading and concise description
2. “Data as of” timestamp
3. KPI card grid
4. Service portfolio and function criticality
5. Third-party exposure and concentration
6. Application and integration impact
7. Dependency complexity
8. Exposure summary
9. Executive insights

Use responsive CSS Grid rather than fixed dimensions.

Charts should have sufficient height and should not be squeezed into small cards.

## Reusable components

Where compatible with the current project, create reusable components such as:

- ExecutiveMetricCard
- DashboardChartCard
- ChartEmptyState
- ChartErrorState
- ExecutiveInsight
- RiskBadge
- CustomChartTooltip
- DashboardSkeleton

Do not over-abstract one-off logic.

## Validation and testing

Add meaningful tests for:

- Distinct service counting
- Duplicate dependency paths
- Third-party service exposure
- Criticality percentage calculations
- Nullable/unassigned functions
- Services sharing applications and integrations
- Hardware attached to either an application or integration
- Empty datasets
- Percentage division by zero
- Ranking and top-N behavior
- Insight generation thresholds

Run the project’s existing:

- Type checker
- Linter
- Unit tests
- Build command

Resolve all errors introduced by the implementation.

## Deliverables

Implement the feature directly in the repository.

At completion, provide:

1. A summary of the implemented dashboard
2. Files created or modified
3. Analytics endpoint and response structure
4. Important SQL aggregation decisions
5. Distinct-count protections used to avoid double-counting
6. Management insights implemented
7. Tests added
8. Commands run and their results
9. Any assumptions or limitations

Do not stop after providing an architecture plan. Inspect the codebase, implement the backend and frontend, test the changes, and leave the repository in a working state.