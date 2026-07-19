import {
  ExecutiveApplicationImpact,
  ExecutiveDashboardSummary,
  ExecutiveDashboardThresholds,
  ExecutiveExposureSummary,
  ExecutiveFunctionComplexity,
  ExecutiveFunctionPortfolio,
  ExecutiveInsight,
  ExecutiveIntegrationImpact,
  ExecutiveSeverity,
  ExecutiveThirdPartyExposure
} from "../../shared";

export const EXECUTIVE_DASHBOARD_THRESHOLDS = {
  enterpriseDependencyServiceShare: 25,
  highCriticalityRate: 50,
  crossFunctionCount: 3,
  functionConcentratedMaxFunctions: 1,
  highlyInterconnectedIntegrationCount: 8,
  applicationConcentrationServiceShare: 20
};

export function buildSummary(input: {
  totalServices: number;
  totalFunctions: number;
  totalApplications: number;
  totalIntegrations: number;
  totalThirdParties: number;
  criticalServices: number;
  thirdPartyDependentServices: number;
  criticalHardwareExposedServices: number;
  averageApplicationsPerService: number;
  averageIntegrationsPerService: number;
}): ExecutiveDashboardSummary {
  return {
    totalServices: metric(input.totalServices, "Distinct services in the dependency portfolio.", "COUNT(DISTINCT service_id) from service dependency paths."),
    totalFunctions: metric(input.totalFunctions, "Business functions represented by the current dependency data.", "COUNT(DISTINCT function_id), treating missing assignments separately in function charts."),
    totalApplications: metric(input.totalApplications, "Distinct applications supporting service delivery.", "COUNT(DISTINCT application_id) from service dependency paths."),
    totalIntegrations: metric(input.totalIntegrations, "Distinct integrations used by applications in service paths.", "COUNT(DISTINCT integration_id) from service dependency paths."),
    totalThirdParties: metric(input.totalThirdParties, "Distinct external providers linked to applications.", "COUNT(DISTINCT third_party_id) from third-party relationships."),
    criticalServices: metric(
      input.criticalServices,
      `${formatPercentage(percentage(input.criticalServices, input.totalServices))} of services are marked critical.`,
      "Distinct services where any dependency path is marked critical.",
      percentage(input.criticalServices, input.totalServices),
      severityFromPercentage(percentage(input.criticalServices, input.totalServices), 50, 30)
    ),
    thirdPartyDependentServices: metric(
      input.thirdPartyDependentServices,
      `${formatPercentage(percentage(input.thirdPartyDependentServices, input.totalServices))} of services depend on at least one third party.`,
      "COUNT(DISTINCT service_id) from third-party relationships.",
      percentage(input.thirdPartyDependentServices, input.totalServices),
      severityFromPercentage(percentage(input.thirdPartyDependentServices, input.totalServices), 60, 35)
    ),
    criticalHardwareExposedServices: metric(
      input.criticalHardwareExposedServices,
      `${formatPercentage(percentage(input.criticalHardwareExposedServices, input.totalServices))} of services touch critical hardware.`,
      "Distinct services whose application or integration path is linked to critical hardware.",
      percentage(input.criticalHardwareExposedServices, input.totalServices),
      severityFromPercentage(percentage(input.criticalHardwareExposedServices, input.totalServices), 45, 25)
    ),
    averageApplicationsPerService: metric(
      round(input.averageApplicationsPerService),
      "Average application breadth per distinct service.",
      "Average of per-service COUNT(DISTINCT application_id)."
    ),
    averageIntegrationsPerService: metric(
      round(input.averageIntegrationsPerService),
      "Average integration breadth per distinct service.",
      "Average of per-service COUNT(DISTINCT integration_id)."
    )
  };
}

export function classifyThirdParties(
  rows: Array<Omit<ExecutiveThirdPartyExposure, "flags" | "riskClass">>,
  totalServices: number
): {
  rows: ExecutiveThirdPartyExposure[];
  thresholds: ExecutiveDashboardThresholds;
} {
  const highExposureServices = percentile(rows.map((row) => row.services), 0.75);
  const highCriticalServices = percentile(rows.map((row) => row.criticalServices), 0.75);
  const thresholds: ExecutiveDashboardThresholds = {
    enterpriseDependencyServiceShare: EXECUTIVE_DASHBOARD_THRESHOLDS.enterpriseDependencyServiceShare,
    highCriticalityRate: EXECUTIVE_DASHBOARD_THRESHOLDS.highCriticalityRate,
    crossFunctionCount: EXECUTIVE_DASHBOARD_THRESHOLDS.crossFunctionCount,
    functionConcentratedMaxFunctions: EXECUTIVE_DASHBOARD_THRESHOLDS.functionConcentratedMaxFunctions,
    highExposureServices,
    highCriticalServices
  };

  return {
    thresholds,
    rows: rows.map((row) => {
      const serviceExposurePercentage = percentage(row.services, totalServices);
      const highExposure = row.services >= highExposureServices && row.services > 0;
      const highCriticality = row.criticalityRate >= thresholds.highCriticalityRate || (row.criticalServices >= highCriticalServices && row.criticalServices > 0);
      const flags: string[] = [];
      if (serviceExposurePercentage >= thresholds.enterpriseDependencyServiceShare) {
        flags.push("Enterprise-wide dependency");
      }
      if (row.criticalityRate >= thresholds.highCriticalityRate) {
        flags.push("High critical concentration");
      }
      if (row.functions >= thresholds.crossFunctionCount) {
        flags.push("Cross-function dependency");
      }
      if (row.functions <= thresholds.functionConcentratedMaxFunctions && row.services > 0) {
        flags.push("Function-concentrated dependency");
      }

      return {
        ...row,
        serviceExposurePercentage,
        flags,
        riskClass: riskClass(highExposure, highCriticality)
      };
    })
  };
}

export function classifyApplications(
  rows: Array<Omit<ExecutiveApplicationImpact, "indicators">>,
  totalServices: number
): ExecutiveApplicationImpact[] {
  return rows.map((row) => {
    const indicators: string[] = [];
    if (percentage(row.services, totalServices) >= EXECUTIVE_DASHBOARD_THRESHOLDS.applicationConcentrationServiceShare) {
      indicators.push("Potential concentration risk");
    }
    if (row.functions >= EXECUTIVE_DASHBOARD_THRESHOLDS.crossFunctionCount) {
      indicators.push("Enterprise-shared application");
    } else if (row.functions > 1) {
      indicators.push("Cross-function application");
    }
    if (row.integrations >= EXECUTIVE_DASHBOARD_THRESHOLDS.highlyInterconnectedIntegrationCount) {
      indicators.push("Highly interconnected application");
    }
    return { ...row, indicators };
  });
}

export function buildExecutiveInsights(input: {
  totalServices: number;
  criticalServices: number;
  servicesByFunction: ExecutiveFunctionPortfolio[];
  topThirdParties: ExecutiveThirdPartyExposure[];
  topApplications: ExecutiveApplicationImpact[];
  topIntegrations: ExecutiveIntegrationImpact[];
  complexityByFunction: ExecutiveFunctionComplexity[];
  exposureSummary: ExecutiveExposureSummary[];
}): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];
  const topTwoFunctions = input.servicesByFunction.slice(0, 2);
  if (topTwoFunctions.length > 0) {
    const services = topTwoFunctions.reduce((sum, row) => sum + row.services, 0);
    insights.push({
      severity: severityFromPercentage(percentage(services, input.totalServices), 60, 45),
      title: "Function concentration",
      detail: `${topTwoFunctions.map((row) => row.name).join(" and ")} account for ${formatPercentage(percentage(services, input.totalServices))} of all services.`
    });
  }

  const topThreeThirdPartiesCritical = input.topThirdParties.slice(0, 3).reduce((sum, row) => sum + row.criticalServices, 0);
  if (topThreeThirdPartiesCritical > 0) {
    insights.push({
      severity: severityFromPercentage(percentage(topThreeThirdPartiesCritical, input.criticalServices), 50, 30),
      title: "External critical-service concentration",
      detail: `The top three third parties touch ${formatPercentage(percentage(topThreeThirdPartiesCritical, input.criticalServices))} of critical services.`
    });
  }

  const topApplication = input.topApplications[0];
  if (topApplication) {
    insights.push({
      severity: topApplication.indicators.includes("Potential concentration risk") ? "High" : "Attention",
      title: "Broadest application impact",
      detail: `${topApplication.name} supports ${topApplication.services} services across ${topApplication.functions} functions.`
    });
  }

  const topIntegration = input.topIntegrations[0];
  if (topIntegration) {
    insights.push({
      severity: topIntegration.criticalServices > 0 ? "Attention" : "Information",
      title: "Largest integration blast radius",
      detail: `${topIntegration.name} is used by ${topIntegration.services} services and ${topIntegration.applications} applications.`
    });
  }

  const highCriticalityFunction = [...input.servicesByFunction].sort((left, right) => right.criticalityRate - left.criticalityRate || right.services - left.services)[0];
  if (highCriticalityFunction) {
    insights.push({
      severity: severityFromPercentage(highCriticalityFunction.criticalityRate, 60, 35),
      title: "Highest function criticality rate",
      detail: `${highCriticalityFunction.name} has a ${formatPercentage(highCriticalityFunction.criticalityRate)} criticality rate across ${highCriticalityFunction.services} services.`
    });
  }

  const overlap = input.exposureSummary.find((row) => row.category === "Third-party and critical-hardware exposed");
  if (overlap) {
    insights.push({
      severity: severityFromPercentage(overlap.percentage, 30, 15),
      title: "Combined external and infrastructure exposure",
      detail: `${overlap.services} services are exposed to both third parties and critical hardware.`
    });
  }

  return insights.slice(0, 6);
}

export function percentage(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) {
    return 0;
  }
  return round((value / total) * 100);
}

function metric(value: number, interpretation: string, calculation: string, percentageValue?: number, severity?: ExecutiveSeverity) {
  return {
    value,
    ...(percentageValue === undefined ? {} : { percentage: percentageValue }),
    interpretation,
    calculation,
    ...(severity ? { severity } : {})
  };
}

function severityFromPercentage(value: number, high: number, attention: number): ExecutiveSeverity {
  if (value >= high) {
    return "High";
  }
  if (value >= attention) {
    return "Attention";
  }
  return "Information";
}

function riskClass(highExposure: boolean, highCriticality: boolean): ExecutiveThirdPartyExposure["riskClass"] {
  if (highExposure && highCriticality) {
    return "High exposure / high criticality";
  }
  if (highExposure) {
    return "High exposure / lower criticality";
  }
  if (highCriticality) {
    return "Lower exposure / high criticality";
  }
  return "Lower exposure / lower criticality";
}

function percentile(values: number[], fraction: number): number {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.ceil(sorted.length * fraction) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function round(value: number): number {
  return Number(value.toFixed(1));
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
