import { createHash } from "node:crypto";

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function hasValue(value: unknown): boolean {
  return normalizeName(value).length > 0;
}

export function toPascalIdentifier(value: string): string {
  const words = normalizeHeader(value)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
  const candidate = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  return candidate || "Unknown";
}

export function toEntityKey(datasetId: string, type: string, normalizedName: string): string {
  return createHash("sha256")
    .update(`${datasetId}::${type}::${normalizedName}`)
    .digest("hex");
}

export function toRelationshipKey(datasetId: string, fromKey: string, type: string, toKey: string): string {
  return createHash("sha256")
    .update(`${datasetId}::${fromKey}::${type}::${toKey}`)
    .digest("hex");
}
