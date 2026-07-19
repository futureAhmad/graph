import { apiClient } from "@/lib/api";

export type OptionItem = {
  id: string;
  name: string;
  category?: string;
};

export type AdminOptions = {
  services: OptionItem[];
  directChannels: OptionItem[];
  applications: OptionItem[];
  integrations: OptionItem[];
  hardwareSpecs: OptionItem[];
  thirdParties: OptionItem[];
};

export type CreateServicePathPayload = {
  functionName?: string;
  service: { id?: string; name: string };
  serviceIsCritical: boolean;
  directChannel: { id?: string; name: string };
  application: { id?: string; name: string };
  integration: { id?: string; name: string };
  hardwareSpec?: {
    name: string;
    category: string;
    sourceType: "application" | "integration";
    isCritical: boolean;
  };
  thirdPartyName?: string;
};

export function getAdminOptions() {
  return apiClient<AdminOptions>("/admin/options");
}

export function createServicePath(payload: CreateServicePathPayload) {
  return apiClient<{ created: true }>("/admin/service-paths", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
