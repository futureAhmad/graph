"use client";

import { FormEvent, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Cpu, PlusCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandOption, CommandSelect } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { useAuth } from "@/components/layout/auth-provider";
import {
  createServicePath,
  getAdminOptions,
  type AdminOptions,
  type OptionItem
} from "@/features/admin/services.api";

type FormState = {
  functionName: string;
  serviceId: string;
  serviceName: string;
  serviceIsCritical: boolean;
  directChannelId: string;
  directChannelName: string;
  applicationId: string;
  applicationName: string;
  integrationId: string;
  integrationName: string;
  hardwareSpecId: string;
  hardwareSpecName: string;
  hardwareSpecCategory: string;
  hardwareSpecSourceType: "application" | "integration";
  hardwareSpecIsCritical: boolean;
  thirdPartyId: string;
  thirdPartyName: string;
};

const emptyOptions: AdminOptions = {
  services: [],
  directChannels: [],
  applications: [],
  integrations: [],
  hardwareSpecs: [],
  thirdParties: []
};

const emptyForm: FormState = {
  functionName: "",
  serviceId: "",
  serviceName: "",
  serviceIsCritical: false,
  directChannelId: "",
  directChannelName: "",
  applicationId: "",
  applicationName: "",
  integrationId: "",
  integrationName: "",
  hardwareSpecId: "",
  hardwareSpecName: "",
  hardwareSpecCategory: "",
  hardwareSpecSourceType: "integration",
  hardwareSpecIsCritical: false,
  thirdPartyId: "",
  thirdPartyName: ""
};

const sourceOptions = [
  { label: "Integration", value: "integration" },
  { label: "Application", value: "application" }
];

export function ServiceAdmin() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [options, setOptions] = useState<AdminOptions>(emptyOptions);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const commandOptions = useMemo(() => toCommandOptions(options), [options]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    void loadOptions();
  }, [authLoading, router, user]);

  async function loadOptions() {
    setLoading(true);
    setError(null);
    try {
      setOptions(await getAdminOptions());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load admin options.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const serviceName = valueFromSelection(form.serviceName, form.serviceId, options.services);
    const directChannelName = valueFromSelection(form.directChannelName, form.directChannelId, options.directChannels);
    const applicationName = valueFromSelection(form.applicationName, form.applicationId, options.applications);
    const integrationName = valueFromSelection(form.integrationName, form.integrationId, options.integrations);
    const hardwareSpecName = valueFromSelection(form.hardwareSpecName, form.hardwareSpecId, options.hardwareSpecs);
    const thirdPartyName = valueFromSelection(form.thirdPartyName, form.thirdPartyId, options.thirdParties);

    if (!serviceName || !directChannelName || !applicationName || !integrationName) {
      setError("Service, direct channel, application, and integration are required.");
      return;
    }

    const hardwareSpec =
      hardwareSpecName || form.hardwareSpecCategory
        ? {
            name: hardwareSpecName,
            category: form.hardwareSpecCategory || selectedItem(form.hardwareSpecId, options.hardwareSpecs)?.category || "Manual",
            sourceType: form.hardwareSpecSourceType,
            isCritical: form.hardwareSpecIsCritical
          }
        : undefined;

    try {
      await createServicePath({
        functionName: form.functionName || undefined,
        service: { id: form.serviceId || undefined, name: serviceName },
        serviceIsCritical: form.serviceIsCritical,
        directChannel: { id: form.directChannelId || undefined, name: directChannelName },
        application: { id: form.applicationId || undefined, name: applicationName },
        integration: { id: form.integrationId || undefined, name: integrationName },
        hardwareSpec,
        thirdPartyName: thirdPartyName || undefined
      });
      setMessage("Service path saved.");
      setForm(emptyForm);
      await loadOptions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save service path.");
    }
  }

  if (authLoading || !user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Add Service</h1>
        <p className="text-sm text-muted-foreground">Create service dependency paths and optional hardware or third-party details.</p>
      </div>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p> : null}
      {message ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{message}</p> : null}
      <Panel className="space-y-5">
        <div className="flex items-center gap-3">
          <PlusCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Dependency Path</h2>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading options...</p>
        ) : (
          <form className="space-y-5" onSubmit={submit}>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                <span>Function</span>
                <Input
                  value={form.functionName}
                  onChange={(event) => setFormValue(setForm, "functionName", event.target.value)}
                  placeholder="Optional function name"
                />
              </label>
              <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.serviceIsCritical}
                  onChange={(event) => setFormValue(setForm, "serviceIsCritical", event.target.checked)}
                />
                Service is critical
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ExistingOrNew
                label="Service"
                options={commandOptions.services}
                selected={form.serviceId}
                typed={form.serviceName}
                onSelected={(value) => setFormValue(setForm, "serviceId", value)}
                onTyped={(value) => setFormValue(setForm, "serviceName", value)}
                required
              />
              <ExistingOrNew
                label="Direct Channel"
                options={commandOptions.directChannels}
                selected={form.directChannelId}
                typed={form.directChannelName}
                onSelected={(value) => setFormValue(setForm, "directChannelId", value)}
                onTyped={(value) => setFormValue(setForm, "directChannelName", value)}
                required
              />
              <ExistingOrNew
                label="Application"
                options={commandOptions.applications}
                selected={form.applicationId}
                typed={form.applicationName}
                onSelected={(value) => setFormValue(setForm, "applicationId", value)}
                onTyped={(value) => setFormValue(setForm, "applicationName", value)}
                required
              />
              <ExistingOrNew
                label="Integration"
                options={commandOptions.integrations}
                selected={form.integrationId}
                typed={form.integrationName}
                onSelected={(value) => setFormValue(setForm, "integrationId", value)}
                onTyped={(value) => setFormValue(setForm, "integrationName", value)}
                required
              />
            </div>
            <div className="space-y-4 rounded-md border border-border bg-background/70 p-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Hardware Specs</h3>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ExistingOrNew
                  label="Spec"
                  options={commandOptions.hardwareSpecs}
                  selected={form.hardwareSpecId}
                  typed={form.hardwareSpecName}
                  onSelected={(value) => {
                    const spec = selectedItem(value, options.hardwareSpecs);
                    setForm((current) => ({
                      ...current,
                      hardwareSpecId: value,
                      hardwareSpecCategory: spec?.category ?? current.hardwareSpecCategory
                    }));
                  }}
                  onTyped={(value) => setFormValue(setForm, "hardwareSpecName", value)}
                />
                <label className="block space-y-1 text-sm font-medium">
                  <span>Spec Category</span>
                  <Input
                    value={form.hardwareSpecCategory}
                    onChange={(event) => setFormValue(setForm, "hardwareSpecCategory", event.target.value)}
                    placeholder="Example: Server, Database, API"
                  />
                </label>
                <label className="block space-y-1 text-sm font-medium">
                  <span>Attach Spec To</span>
                  <CommandSelect
                    options={sourceOptions}
                    value={form.hardwareSpecSourceType}
                    onValueChange={(value) =>
                      setFormValue(setForm, "hardwareSpecSourceType", value as "application" | "integration")
                    }
                  />
                </label>
                <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.hardwareSpecIsCritical}
                    onChange={(event) => setFormValue(setForm, "hardwareSpecIsCritical", event.target.checked)}
                  />
                  Hardware spec is critical
                </label>
              </div>
            </div>
            <ExistingOrNew
              label="Third Party"
              options={commandOptions.thirdParties}
              selected={form.thirdPartyId}
              typed={form.thirdPartyName}
              onSelected={(value) => setFormValue(setForm, "thirdPartyId", value)}
              onTyped={(value) => setFormValue(setForm, "thirdPartyName", value)}
            />
            <Button type="submit">
              <Save className="h-4 w-4" />
              Save Service
            </Button>
          </form>
        )}
      </Panel>
    </div>
  );
}

function ExistingOrNew({
  label,
  options,
  selected,
  typed,
  onSelected,
  onTyped,
  required = false
}: {
  label: string;
  options: CommandOption[];
  selected: string;
  typed: string;
  onSelected: (value: string) => void;
  onTyped: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block space-y-1 text-sm font-medium">
        <span>{label}</span>
        <CommandSelect
          options={options}
          value={selected}
          onValueChange={onSelected}
          placeholder={`Select ${label.toLowerCase()}`}
          searchPlaceholder={`Search ${label.toLowerCase()}...`}
        />
      </label>
      <Input
        value={typed}
        onChange={(event) => onTyped(event.target.value)}
        placeholder={`Or add new ${label.toLowerCase()}${required ? " *" : ""}`}
      />
    </div>
  );
}

function toCommandOptions(options: AdminOptions): Record<keyof AdminOptions, CommandOption[]> {
  return {
    services: options.services.map(toCommandOption),
    directChannels: options.directChannels.map(toCommandOption),
    applications: options.applications.map(toCommandOption),
    integrations: options.integrations.map(toCommandOption),
    hardwareSpecs: options.hardwareSpecs.map((option) => ({
      label: option.category ? `${option.name} (${option.category})` : option.name,
      value: option.id
    })),
    thirdParties: options.thirdParties.map(toCommandOption)
  };
}

function toCommandOption(option: OptionItem): CommandOption {
  return { label: option.name, value: option.id };
}

function valueFromSelection(typed: string, selectedId: string, options: OptionItem[]): string {
  const trimmed = typed.trim();
  return trimmed || selectedItem(selectedId, options)?.name || "";
}

function selectedItem(id: string, options: OptionItem[]): OptionItem | undefined {
  return options.find((option) => option.id === id);
}

function setFormValue<K extends keyof FormState>(
  setForm: Dispatch<SetStateAction<FormState>>,
  key: K,
  value: FormState[K]
) {
  setForm((current) => ({ ...current, [key]: value }));
}
