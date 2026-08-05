import { and, asc, desc, eq } from "drizzle-orm";

import { getAppDatabase } from "../bootstrap.server";
import type {
  DictionaryEntry,
  DictionarySort,
} from "../features/dictionary/model";
import type { SubmissionRepository } from "../features/submission/server/repository";
import {
  normalizeAcronym,
  normalizeDefinition,
  parseDefinitionMarkup,
} from "../domain/acronym";
import type { AppDatabase } from "./client.server";
import { acronymEntries } from "./schema";
import { insertAcronymEntryAtomic } from "./write.server";

export function createAcronymRepository(database: AppDatabase) {
  async function listPublishedAcronyms(
    searchTerm: string,
    sort: DictionarySort = "alphabetical",
  ) {
    const entries = await database
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
        ...(sort === "recent"
          ? [
              desc(acronymEntries.createdAt),
              asc(acronymEntries.normalizedAcronym),
            ]
          : [
              asc(acronymEntries.normalizedAcronym),
              asc(acronymEntries.variant),
            ]),
      );

    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return entries;
    }

    return entries
      .map((entry) => ({
        entry,
        score: getSearchScore(entry, normalizedSearch),
      }))
      .filter((result) => result.score !== null)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score! - right.score!;
        }

        return compareEntries(left.entry, right.entry, sort);
      })
      .map((result) => result.entry);
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

  const repository = {
    listPublishedAcronyms,
    findPublishedByAcronym,
    findPublishedByVariant,
    findExactDuplicate,
    createAcronymEntry,
  };

  repository satisfies SubmissionRepository;
  return repository;
}

type AcronymRepository = ReturnType<typeof createAcronymRepository>;

function getAcronymRepository() {
  return createAcronymRepository(getAppDatabase());
}

export function listPublishedAcronyms(
  ...arguments_: Parameters<AcronymRepository["listPublishedAcronyms"]>
) {
  return getAcronymRepository().listPublishedAcronyms(...arguments_);
}

export function findPublishedByAcronym(
  ...arguments_: Parameters<AcronymRepository["findPublishedByAcronym"]>
) {
  return getAcronymRepository().findPublishedByAcronym(...arguments_);
}

export function findPublishedByVariant(
  ...arguments_: Parameters<AcronymRepository["findPublishedByVariant"]>
) {
  return getAcronymRepository().findPublishedByVariant(...arguments_);
}

export function findExactDuplicate(
  ...arguments_: Parameters<AcronymRepository["findExactDuplicate"]>
) {
  return getAcronymRepository().findExactDuplicate(...arguments_);
}

export function createAcronymEntry(
  ...arguments_: Parameters<AcronymRepository["createAcronymEntry"]>
) {
  return getAcronymRepository().createAcronymEntry(...arguments_);
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

function getSearchScore(
  entry: DictionaryEntry,
  normalizedSearch: string,
): number | null {
  const fields = [entry.acronym, entry.definition].map((field) =>
    field.toLowerCase(),
  );

  if (fields.some((field) => field === normalizedSearch)) {
    return 0;
  }

  if (fields.some((field) => field.startsWith(normalizedSearch))) {
    return 1;
  }

  if (fields.some((field) => field.includes(normalizedSearch))) {
    return 2;
  }

  const fuzzyThreshold = normalizedSearch.length <= 5 ? 1 : 2;
  const words = fields.flatMap((field) => field.split(/[^a-z0-9]+/));

  return words.some(
    (word) =>
      word.length > 0 &&
      Math.abs(word.length - normalizedSearch.length) <= fuzzyThreshold &&
      levenshteinDistance(word, normalizedSearch) <= fuzzyThreshold,
  )
    ? 3
    : null;
}

function compareEntries(
  left: DictionaryEntry,
  right: DictionaryEntry,
  sort: DictionarySort,
) {
  if (sort === "recent" && left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return (
    left.acronym.localeCompare(right.acronym) || left.variant - right.variant
  );
}

function levenshteinDistance(left: string, right: string) {
  const distances = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previousDiagonal = distances[0];
    distances[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = distances[rightIndex];
      distances[rightIndex] = Math.min(
        distances[rightIndex] + 1,
        distances[rightIndex - 1] + 1,
        previousDiagonal +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      previousDiagonal = previous;
    }
  }

  return distances[right.length];
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
