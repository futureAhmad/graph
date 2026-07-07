export const NODE_COLORS: Record<string, string> = {
  Service: "#0ea5e9",
  Function: "#22c55e",
  Application: "#f97316",
  Integration: "#1d8cff",
  DirectChannel: "#a78bfa",
  HardwareSpec: "#cbd5e1",
  Database: "#cbd5e1",
  API: "#22c55e",
  Queue: "#e879f9",
  ExternalSystem: "#4ade80",
  ThirdParty: "#4ade80",
  Server: "#94a3b8",
  Hardware: "#cbd5e1"
};

export function colorForType(type: string): string {
  return NODE_COLORS[type] ?? "#334155";
}
