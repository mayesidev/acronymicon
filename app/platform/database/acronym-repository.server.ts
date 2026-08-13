import { and, asc, eq } from "drizzle-orm";

import type { DictionaryRepository } from "../../features/dictionary/server/repository";
import type {
  SubmissionCreateResult,
  SubmissionRepository,
} from "../../features/submission/server/repository";
import {
  normalizeAcronym,
  normalizeDefinition,
  parseDefinitionMarkup,
} from "../../domain/acronym";
import type { AppDatabase } from "./client.server";
import { acronymEntries } from "./schema";
import { insertAcronymEntryAtomic } from "./write.server";

type AcronymRepository = DictionaryRepository &
  Omit<SubmissionRepository, "createAcronymEntry"> & {
    createAcronymEntry: (
      input: Parameters<SubmissionRepository["createAcronymEntry"]>[0],
    ) => SubmissionCreateResult;
  };

export function createAcronymRepository(
  database: AppDatabase,
): AcronymRepository {
  async function listPublishedEntries() {
    return database
      .select({
        id: acronymEntries.id,
        acronym: acronymEntries.acronym,
        variant: acronymEntries.variant,
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
      .orderBy(
        asc(acronymEntries.normalizedAcronym),
        asc(acronymEntries.variant),
      );
  }

  async function findPublishedByAcronym(acronym: string) {
    return database
      .select({
        id: acronymEntries.id,
        acronym: acronymEntries.acronym,
        variant: acronymEntries.variant,
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
      .orderBy(asc(acronymEntries.variant));
  }

  async function findPublishedById(id: string) {
    const [entry] = await database
      .select({
        id: acronymEntries.id,
        acronym: acronymEntries.acronym,
        variant: acronymEntries.variant,
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
        and(eq(acronymEntries.status, "published"), eq(acronymEntries.id, id)),
      )
      .limit(1);

    return entry ?? null;
  }

  async function findPublishedByVariant(acronym: string, variant: number) {
    const [entry] = await database
      .select({
        id: acronymEntries.id,
        acronym: acronymEntries.acronym,
        variant: acronymEntries.variant,
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
          eq(acronymEntries.variant, variant),
        ),
      )
      .limit(1);

    return entry ?? null;
  }

  async function findExactDuplicate(input: {
    acronym: string;
    definition: string;
  }) {
    const [duplicate] = await database
      .select({
        id: acronymEntries.id,
        definition: acronymEntries.definition,
      })
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

  function createAcronymEntry(
    input: Parameters<typeof buildNewAcronymEntry>[0],
  ) {
    return insertAcronymEntryAtomic(database, buildNewAcronymEntry(input));
  }

  return {
    listPublishedEntries,
    findPublishedById,
    findPublishedByAcronym,
    findPublishedByVariant,
    findExactDuplicate,
    createAcronymEntry,
  };
}

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

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
