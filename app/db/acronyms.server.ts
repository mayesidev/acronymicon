import { asc, eq } from "drizzle-orm";

import { db } from "./client.server";
import { normalizeAcronym, normalizeDefinition } from "./normalize";
import { acronymEntries, type AcronymEntry } from "./schema";

export type AcronymSearchResult = Pick<
  AcronymEntry,
  | "id"
  | "acronym"
  | "definition"
  | "notes"
  | "category"
  | "tags"
  | "aliases"
  | "source"
  | "submittedByUsername"
  | "submittedByDisplayName"
  | "createdAt"
>;

export async function listPublishedAcronyms(searchTerm: string) {
  const entries = await db
    .select({
      id: acronymEntries.id,
      acronym: acronymEntries.acronym,
      definition: acronymEntries.definition,
      notes: acronymEntries.notes,
      category: acronymEntries.category,
      tags: acronymEntries.tags,
      aliases: acronymEntries.aliases,
      source: acronymEntries.source,
      submittedByUsername: acronymEntries.submittedByUsername,
      submittedByDisplayName: acronymEntries.submittedByDisplayName,
      createdAt: acronymEntries.createdAt,
    })
    .from(acronymEntries)
    .where(eq(acronymEntries.status, "published"))
    .orderBy(asc(acronymEntries.normalizedAcronym));

  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return entries;
  }

  return entries.filter((entry) => matchesSearch(entry, normalizedSearch));
}

export function buildNewAcronymEntry(input: {
  acronym: string;
  definition: string;
  notes?: string;
  category?: string;
  tags?: string[];
  aliases?: string[];
  source?: string;
  submittedByUserId?: string;
  submittedByUsername?: string;
  submittedByDisplayName?: string;
}) {
  return {
    id: crypto.randomUUID(),
    acronym: input.acronym.trim(),
    normalizedAcronym: normalizeAcronym(input.acronym),
    definition: input.definition.trim(),
    normalizedDefinition: normalizeDefinition(input.definition),
    notes: normalizeOptional(input.notes),
    category: normalizeOptional(input.category),
    tags: input.tags ?? [],
    aliases: input.aliases ?? [],
    source: normalizeOptional(input.source),
    status: "published" as const,
    submittedByUserId: normalizeOptional(input.submittedByUserId),
    submittedByUsername: normalizeOptional(input.submittedByUsername),
    submittedByDisplayName: normalizeOptional(input.submittedByDisplayName),
  };
}

function matchesSearch(entry: AcronymSearchResult, normalizedSearch: string) {
  const searchableText = [
    entry.acronym,
    entry.definition,
    entry.notes,
    entry.category,
    entry.source,
    entry.submittedByUsername,
    entry.submittedByDisplayName,
    ...entry.tags,
    ...entry.aliases,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
