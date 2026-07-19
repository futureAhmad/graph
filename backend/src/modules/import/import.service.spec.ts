import { CANONICAL_NODE_TYPES, RELATIONSHIP_TYPES } from "../../shared";
import * as XLSX from "xlsx";
import { ColumnRegistryService } from "./column-registry.service";
import { ImportService } from "./import.service";

describe("ImportService", () => {
  const service = new ImportService(new ColumnRegistryService(), {} as never);

  it("imports workbook rows as service to direct channel to application to integration chains", () => {
    const plan = service.createImportPlan(
      [
        {
          "function name": "1",
          "service name": "stock",
          dc: "branch",
          app: "CRM",
          integ: "IBM"
        }
      ],
      { datasetId: "default", sourceName: "test.xlsx", sheetName: "Sheet1" }
    );

    expect(plan.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: CANONICAL_NODE_TYPES.SERVICE, name: "stock" }),
        expect.objectContaining({ type: CANONICAL_NODE_TYPES.DIRECT_CHANNEL, name: "branch" }),
        expect.objectContaining({ type: CANONICAL_NODE_TYPES.APPLICATION, name: "CRM" }),
        expect.objectContaining({ type: CANONICAL_NODE_TYPES.INTEGRATION, name: "IBM" })
      ])
    );
    expect(plan.nodes).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: CANONICAL_NODE_TYPES.FUNCTION })]));

    const serviceNode = plan.nodes.find((node) => node.type === CANONICAL_NODE_TYPES.SERVICE);
    const channelNode = plan.nodes.find((node) => node.type === CANONICAL_NODE_TYPES.DIRECT_CHANNEL);
    const appNode = plan.nodes.find((node) => node.type === CANONICAL_NODE_TYPES.APPLICATION);
    const integrationNode = plan.nodes.find((node) => node.type === CANONICAL_NODE_TYPES.INTEGRATION);

    expect(plan.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromKey: serviceNode?.entityKey,
          toKey: channelNode?.entityKey,
          type: RELATIONSHIP_TYPES.AVAILABLE_ON
        }),
        expect.objectContaining({
          fromKey: channelNode?.entityKey,
          toKey: appNode?.entityKey,
          type: RELATIONSHIP_TYPES.DEPENDS_ON
        }),
        expect.objectContaining({
          fromKey: appNode?.entityKey,
          toKey: integrationNode?.entityKey,
          type: RELATIONSHIP_TYPES.DEPENDS_ON
        })
      ])
    );
  });

  it("ignores sheet metadata columns while importing the current dependency sheet headers", () => {
    const plan = service.createImportPlan(
      [
        {
          no: "1",
          "function name": "Payments",
          "service name": "Transfer",
          "delivery channel": "Mobile",
          critical_service: "Yes",
          application: "CRM",
          integeration: "ESB",
          critical_application: "No",
          critical_integeration: "Yes"
        }
      ],
      { datasetId: "default", sourceName: "test.xlsx", sheetName: "Sheet1" }
    );

    expect(plan.facts).toEqual([
      expect.objectContaining({
        serviceName: "Transfer",
        serviceIsCritical: true,
        directChannelName: "Mobile",
        applicationName: "CRM",
        integrationName: "ESB"
      })
    ]);
    expect(plan.nodes).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "No" })]));
    expect(plan.nodes).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "CriticalService" })]));
  });

  it("imports hardware specs from the second workbook sheet by source", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          "function name": "Payments",
          "service name": "Transfer",
          dc: "Mobile",
          app: "CRM",
          integration: "ESB"
        }
      ]),
      "data"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          source: "CRM",
          server: "AppServer01",
          server_is_critical: "Yes",
          db: "Oracle",
          db_is_critical: "No"
        },
        {
          source: "ESB",
          firewall: "Palo Alto",
          firewall_is_critical: "Critical"
        }
      ]),
      "hardware"
    );

    const plan = service.createWorkbookImportPlan(workbook, { datasetId: "default", sourceName: "test.xlsx" });

    expect(plan.hardwareSpecs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceName: "CRM",
          sourceType: CANONICAL_NODE_TYPES.APPLICATION,
          specName: "AppServer01",
          specCategory: "server",
          isCritical: true
        }),
        expect.objectContaining({
          sourceName: "ESB",
          sourceType: CANONICAL_NODE_TYPES.INTEGRATION,
          specName: "Palo Alto",
          specCategory: "firewall",
          isCritical: true
        })
      ])
    );
  });

  it("imports third-party company names from the third workbook sheet", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          "function name": "Payments",
          "service name": "Transfer",
          dc: "Mobile",
          app: "CRM",
          integration: "ESB"
        }
      ]),
      "data"
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ source: "ESB", server: "AppServer01" }]), "hardware");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          no: "1",
          "function name": "Payments",
          "service name": "Transfer",
          dc: "Mobile",
          app: "CRM",
          thrid: "Payment gateway (Acme Pay)",
          type: "Payment gateway",
          "Company name": "Acme Pay"
        }
      ]),
      "third_party"
    );

    const plan = service.createWorkbookImportPlan(workbook, { datasetId: "default", sourceName: "test.xlsx" });

    expect(plan.thirdParties).toEqual([
      expect.objectContaining({
        serviceName: "Transfer",
        directChannelName: "Mobile",
        applicationName: "CRM",
        thirdPartyName: "Acme Pay"
      })
    ]);
  });
});
