const CYPHER_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

export function assertSafeCypherIdentifier(value: string, description: string): string {
  if (!CYPHER_IDENTIFIER.test(value)) {
    throw new Error(`Unsafe ${description}: ${value}`);
  }

  return value;
}

export function cypherLabel(label: string): string {
  return `\`${assertSafeCypherIdentifier(label, "label")}\``;
}

export function cypherRelationshipType(type: string): string {
  return `\`${assertSafeCypherIdentifier(type, "relationship type")}\``;
}
