import type { DictionaryEntry, DictionarySort } from "../model";
import { normalizeAcronym } from "../../../domain/acronym";
import type { DictionaryListRepository } from "./repository";

export function createDictionaryReadService(
  repository: DictionaryListRepository,
) {
  async function listPublishedAcronyms(
    searchTerm: string,
    sort: DictionarySort = "alphabetical",
  ) {
    const entries = await repository.listPublishedEntries();
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matches = normalizedSearch
      ? entries
          .map((entry) => ({
            entry,
            score: getSearchScore(entry, normalizedSearch),
          }))
          .filter(
            (result): result is { entry: DictionaryEntry; score: number } =>
              result.score !== null,
          )
          .sort(
            (left, right) =>
              left.score - right.score ||
              compareEntries(left.entry, right.entry, sort),
          )
          .map((result) => result.entry)
      : [...entries].sort((left, right) =>
          compareBrowseEntries(left, right, sort),
        );

    return matches;
  }

  return { listPublishedAcronyms };
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

function compareBrowseEntries(
  left: DictionaryEntry,
  right: DictionaryEntry,
  sort: DictionarySort,
) {
  if (sort === "recent" && left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return (
    normalizeAcronym(left.acronym).localeCompare(
      normalizeAcronym(right.acronym),
    ) || left.variant - right.variant
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
