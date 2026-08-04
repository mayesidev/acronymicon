import { and, asc, eq } from "drizzle-orm";

import { db, type AppDatabase } from "./client.server";
import {
  normalizeAcronym,
  normalizeDefinition,
  parseDefinitionMarkup,
} from "./normalize";
import { acronymEntries, type AcronymEntry } from "./schema";

export type AcronymSearchResult = Pick<
  AcronymEntry,
  | "id"
  | "acronym"
  | "definition"
  | "definitionRanges"
  | "notes"
  | "aliases"
  | "submittedByUsername"
  | "submittedByDisplayName"
  | "createdAt"
>;

export function createAcronymRepository(database: AppDatabase) {
  async function listPublishedAcronyms(searchTerm: string) {
    const entries = await database
      .select({
        id: acronymEntries.id,
        acronym: acronymEntries.acronym,
        definition: acronymEntries.definition,
        definitionRanges: acronymEntries.definitionRanges,
        notes: acronymEntries.notes,
        aliases: acronymEntries.aliases,
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

  async function findPublishedByAcronym(acronym: string) {
    return database
      .select({
        id: acronymEntries.id,
        acronym: acronymEntries.acronym,
        definition: acronymEntries.definition,
        definitionRanges: acronymEntries.definitionRanges,
        notes: acronymEntries.notes,
        aliases: acronymEntries.aliases,
        submittedByUsername: acronymEntries.submittedByUsername,
        submittedByDisplayName: acronymEntries.submittedByDisplayName,
        createdAt: acronymEntries.createdAt,
      })
      .from(acronymEntries)
      .where(
        and(
          eq(acronymEntries.status, "published"),
          eq(acronymEntries.normalizedAcronym, normalizeAcronym(acronym)),
        ),
      )
      .orderBy(asc(acronymEntries.normalizedDefinition));
  }

  async function findExactDuplicate(input: {
    acronym: string;
    definition: string;
  }) {
    const [duplicate] = await database
      .select({ id: acronymEntries.id })
      .from(acronymEntries)
      .where(
        and(
          eq(acronymEntries.normalizedAcronym, normalizeAcronym(input.acronym)),
          eq(
            acronymEntries.normalizedDefinition,
            normalizeDefinition(input.definition),
          ),
        ),
      )
      .limit(1);

    return duplicate ?? null;
  }

  async function createAcronymEntry(
    input: Parameters<typeof buildNewAcronymEntry>[0],
  ) {
    const [entry] = await database
      .insert(acronymEntries)
      .values(buildNewAcronymEntry(input))
      .returning({
        id: acronymEntries.id,
        acronym: acronymEntries.acronym,
        definition: acronymEntries.definition,
      });

    return entry;
  }

  return {
    listPublishedAcronyms,
    findPublishedByAcronym,
    findExactDuplicate,
    createAcronymEntry,
  };
}

export const {
  listPublishedAcronyms,
  findPublishedByAcronym,
  findExactDuplicate,
  createAcronymEntry,
} = createAcronymRepository(db);

export function buildNewAcronymEntry(input: {
  acronym: string;
  definition: string;
  notes?: string;
  aliases?: string[];
  submittedByUserId?: string;
  submittedByUsername?: string;
  submittedByDisplayName?: string;
}) {
  const parsedDefinition = parseDefinitionMarkup(input.definition);

  return {
    id: crypto.randomUUID(),
    acronym: input.acronym.trim(),
    normalizedAcronym: normalizeAcronym(input.acronym),
    definition: parsedDefinition.text,
    definitionRanges: parsedDefinition.ranges,
    normalizedDefinition: normalizeDefinition(parsedDefinition.text),
    notes: normalizeOptional(input.notes),
    aliases: input.aliases ?? [],
    status: "published" as const,
    submittedByUserId: normalizeOptional(input.submittedByUserId),
    submittedByUsername: normalizeOptional(input.submittedByUsername),
    submittedByDisplayName: normalizeOptional(input.submittedByDisplayName),
  };
}

function matchesSearch(entry: AcronymSearchResult, normalizedSearch: string) {
  const searchableText = [entry.acronym, entry.definition]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
