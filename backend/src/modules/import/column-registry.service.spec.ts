import { RELATIONSHIP_TYPES } from "@service-dependency/shared";
import { ColumnRegistryService } from "./column-registry.service";

describe("ColumnRegistryService", () => {
  const registry = new ColumnRegistryService();

  it("maps known columns to canonical node types", () => {
    expect(registry.resolve("service name")).toMatchObject({
      nodeType: "Service",
      isServiceColumn: true
    });
    expect(registry.resolve("dc")).toMatchObject({
      nodeType: "DirectChannel",
      relationshipType: RELATIONSHIP_TYPES.AVAILABLE_ON
    });
    expect(registry.resolve("integ")).toMatchObject({
      nodeType: "Integration",
      relationshipType: RELATIONSHIP_TYPES.DEPENDS_ON
    });
  });

  it("turns future columns into node types without code changes", () => {
    expect(registry.resolve("cloud service")).toMatchObject({
      nodeType: "CloudService",
      relationshipType: RELATIONSHIP_TYPES.DEPENDS_ON
    });
  });
});
