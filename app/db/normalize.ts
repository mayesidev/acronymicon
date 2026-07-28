export function normalizeAcronym(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeDefinition(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
