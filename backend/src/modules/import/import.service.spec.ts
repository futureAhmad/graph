import { CANONICAL_NODE_TYPES, RELATIONSHIP_TYPES } from "@service-dependency/shared";
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
});
