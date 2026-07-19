import {
  buildExecutiveInsights,
  buildSummary,
  classifyApplications,
  classifyThirdParties,
  percentage
} from "./executive-dashboard.analytics";

describe("executive dashboard analytics", () => {
  it("calculates percentages without dividing by zero", () => {
    expect(percentage(4, 8)).toBe(50);
    expect(percentage(4, 0)).toBe(0);
  });

  it("builds summary metrics from distinct-count inputs", () => {
    const summary = buildSummary({
      totalServices: 10,
      totalFunctions: 2,
      totalApplications: 6,
      totalIntegrations: 9,
      totalThirdParties: 3,
      criticalServices: 4,
      thirdPartyDependentServices: 5,
      criticalHardwareExposedServices: 2,
      averageApplicationsPerService: 1.66,
      averageIntegrationsPerService: 2.34
    });

    expect(summary.criticalServices.value).toBe(4);
    expect(summary.criticalServices.percentage).toBe(40);
    expect(summary.thirdPartyDependentServices.percentage).toBe(50);
    expect(summary.averageApplicationsPerService.value).toBe(1.7);
    expect(summary.averageIntegrationsPerService.value).toBe(2.3);
  });

  it("classifies third-party exposure and risk using named thresholds", () => {
    const { rows, thresholds } = classifyThirdParties(
      [
        {
          name: "Provider A",
          services: 8,
          criticalServices: 5,
          applications: 4,
          functions: 4,
          serviceExposurePercentage: 0,
          criticalityRate: 62.5
        },
        {
          name: "Provider B",
          services: 3,
          criticalServices: 0,
          applications: 2,
          functions: 1,
          serviceExposurePercentage: 0,
          criticalityRate: 0
        }
      ],
      20
    );

    expect(thresholds.enterpriseDependencyServiceShare).toBe(25);
    expect(rows[0].serviceExposurePercentage).toBe(40);
    expect(rows[0].flags).toEqual(expect.arrayContaining(["Enterprise-wide dependency", "High critical concentration", "Cross-function dependency"]));
    expect(rows[0].riskClass).toBe("High exposure / high criticality");
    expect(rows[1].flags).toContain("Function-concentrated dependency");
  });

  it("flags application concentration without claiming single point of failure", () => {
    const rows = classifyApplications(
      [
        {
          name: "Application A",
          services: 6,
          criticalServices: 2,
          functions: 3,
          directChannels: 2,
          integrations: 9,
          thirdParties: 2,
          hardwareSpecs: 4
        }
      ],
      20
    );

    expect(rows[0].indicators).toEqual(
      expect.arrayContaining(["Potential concentration risk", "Enterprise-shared application", "Highly interconnected application"])
    );
  });

  it("generates deterministic management insights from aggregated rows", () => {
    const insights = buildExecutiveInsights({
      totalServices: 20,
      criticalServices: 8,
      servicesByFunction: [
        { name: "Retail", services: 8, criticalServices: 3, portfolioPercentage: 40, criticalityRate: 37.5 },
        { name: "Payments", services: 5, criticalServices: 4, portfolioPercentage: 25, criticalityRate: 80 }
      ],
      topThirdParties: [
        {
          name: "Provider A",
          services: 7,
          criticalServices: 4,
          applications: 4,
          functions: 2,
          serviceExposurePercentage: 35,
          criticalityRate: 57.1,
          flags: [],
          riskClass: "High exposure / high criticality"
        }
      ],
      topApplications: [
        {
          name: "Application A",
          services: 6,
          criticalServices: 3,
          functions: 3,
          directChannels: 2,
          integrations: 5,
          thirdParties: 2,
          hardwareSpecs: 4,
          indicators: ["Potential concentration risk"]
        }
      ],
      topIntegrations: [
        {
          name: "Integration A",
          services: 5,
          criticalServices: 2,
          applications: 2,
          functions: 2,
          channels: 3,
          criticalHardwareSpecs: 1,
          hardwareSpecs: 2
        }
      ],
      complexityByFunction: [],
      exposureSummary: [
        {
          category: "Third-party and critical-hardware exposed",
          services: 3,
          percentage: 15,
          calculation: "Distinct overlap."
        }
      ]
    });

    expect(insights.map((insight) => insight.title)).toEqual(
      expect.arrayContaining(["Function concentration", "Broadest application impact", "Largest integration blast radius"])
    );
  });
});
